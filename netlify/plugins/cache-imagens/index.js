// Plugin local do Netlify: restaura e salva .cache/ (imagens já otimizadas pelo build.py) entre builds.
module.exports = {
  async onPreBuild({ utils }) {
    const ok = await utils.cache.restore('.cache');
    console.log(ok ? 'cache-imagens: .cache restaurado' : 'cache-imagens: sem cache anterior (primeiro build)');
  },
  async onPostBuild({ utils }) {
    await utils.cache.save('.cache');
    console.log('cache-imagens: .cache salvo');
  },
};
