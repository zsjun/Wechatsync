const modules = import.meta.glob('./src/*.js', { eager: true })
const drivers = {}

for (const path in modules) {
  const module = modules[path]
  const moduleName = module.default ? module.default.name : null
  if (moduleName && moduleName !== 'BaseAdapter') {
    drivers[moduleName] = module.default
  }
}

export default drivers
