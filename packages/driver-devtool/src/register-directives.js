export default (app) => {
  app.directive('focus', {
    mounted(el) {
      el.focus()
    },
  })
}

