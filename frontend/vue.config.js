// Vue 3 설정
module.exports = {
  transpileDependencies: [],
  productionSourceMap: false,
  
  // Vue CLI 설정
  configureWebpack: {
    resolve: {
      alias: {
        // vue-template-compiler가 설치되어 있으면 무시하고 @vue/compiler-sfc 사용
        'vue-template-compiler': '@vue/compiler-sfc'
      }
    }
  }
} 