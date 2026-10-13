"""Real-ESRGAN x4plus (RRDBNet) on CPU with tiling.
Usage: python upscale.py <weights.pth> <out_dir> <img> [<img> ...]
Writes <out_dir>/<name>-x4.png (lossless) for each input."""
import os, sys, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
from PIL import Image


class RDB(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = RDB(nf, gc), RDB(nf, gc), RDB(nf, gc)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, nf=64, nb=23, gc=32):
        super().__init__()
        self.conv_first = nn.Conv2d(3, nf, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


def load(weights):
    net = RRDBNet()
    sd = torch.load(weights, map_location='cpu', weights_only=True)
    sd = sd.get('params_ema', sd.get('params', sd))
    net.load_state_dict(sd, strict=True)
    return net.eval().to(memory_format=torch.channels_last)


@torch.inference_mode()
def upscale(net, im, tile=200, pad=12):
    a = torch.from_numpy(np.asarray(im.convert('RGB')).astype(np.float32) / 255.).permute(2, 0, 1)[None]
    _, _, H, W = a.shape
    out = torch.zeros(1, 3, H * 4, W * 4)
    for y in range(0, H, tile):
        for x in range(0, W, tile):
            y0, x0 = max(0, y - pad), max(0, x - pad)
            y1, x1 = min(H, y + tile + pad), min(W, x + tile + pad)
            o = net(a[:, :, y0:y1, x0:x1].contiguous(memory_format=torch.channels_last))
            ty1, tx1 = min(H, y + tile), min(W, x + tile)
            out[:, :, y * 4:ty1 * 4, x * 4:tx1 * 4] = o[:, :, (y - y0) * 4:(ty1 - y0) * 4, (x - x0) * 4:(tx1 - x0) * 4]
    arr = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255 + 0.5).astype(np.uint8)
    return Image.fromarray(arr)


if __name__ == '__main__':
    torch.set_num_threads(max(1, os.cpu_count() or 4))
    weights, out_dir, *imgs = sys.argv[1:]
    os.makedirs(out_dir, exist_ok=True)
    net = load(weights)
    for p in imgs:
        name = os.path.splitext(os.path.basename(p))[0]
        dst = os.path.join(out_dir, name + '-x4.png')
        if os.path.exists(dst):
            print('skip', name, flush=True); continue
        t = time.time()
        upscale(net, Image.open(p)).save(dst, optimize=False, compress_level=3)
        print(f'{name}: {time.time() - t:.0f}s', flush=True)
