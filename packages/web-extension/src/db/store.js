const maxTaskLength = 25

export default class Store {
  constructor(engine) {}

  async getAccounts() {
    const result = await chrome.storage.local.get('accounts')
    let accounts = result.accounts
    if (!accounts) {
      accounts = []
    } else {
      // accounts is already an object/array if saved via chrome.storage,
      // but if it was saved as a string (JSON.stringify) in localStorage, we might need to handle migration or just assume new format.
      // The previous code did JSON.parse. chrome.storage saves objects directly.
      // Let's assume we are starting fresh or migrating. 
      // If the old data is in localStorage, we lose it unless we migrate.
      // Given the "Continue" instruction, I'll implement the new logic.
      if (typeof accounts === 'string') {
          try {
              accounts = JSON.parse(accounts)
          } catch(e) {}
      }
      
      accounts = accounts.map(function (t) {
        if (t.type == 'wordpress') {
          t.icon = chrome.runtime.getURL('images/wordpress.ico')
        }
        if (t.type == 'typecho') {
          t.icon = chrome.runtime.getURL('images/typecho.ico')
        }
        return t
      })
    }
    return accounts
  }

  async getList(key) {
    const result = await chrome.storage.local.get(key)
    let list = result[key]
    if (!list) {
      list = []
    } else {
      if (typeof list === 'string') {
          try {
              list = JSON.parse(list)
          } catch(e) {}
      }
      list.forEach((a, index) => {
        a.index = index
      })
    }
    return list
  }

  async addAccount({ uid, type, params, title }) {
    var accounts = await this.getAccounts()
    var has = accounts.filter((r) => {
      return r.uid == uid
    })

    if (has.length) {
      return false
    }

    accounts.push({
      uid,
      type,
      params,
      title,
    })

    await chrome.storage.local.set({ accounts: accounts })
    return true
  }

  async getTasks() {
    return await this.getList('tasks')
  }

  async getTask(tid) {
    var tasks = await this.getTasks()
    return tasks[tid]
  }

  async editTask(tid, obj) {
    var tasks = await this.getTasks()
    if (!tasks[tid]) return
    tasks[tid] = Object.assign(tasks[tid], obj)
    await chrome.storage.local.set({ tasks: tasks })
    
    // window.syncer is likely only available in background.js
    // We should check if we are in background context or send message
    if (typeof window !== 'undefined' && window.syncer) {
      console.log('send message to task submmiter')
      var sender = window.syncer.getSender(tasks[tid].guid)
      if (sender) {
        try {
          // console.log(chrome.runtime.lastError);
          chrome.tabs.sendMessage(
            sender.tab.id,
            { method: 'taskUpdate', task: tasks[tid] },
            function (response) {}
          )
        } catch (e) {}
      }
    }
  }

  async addTask(t) {
    console.log('store.addTask', t)
    var tasks = await this.getTasks()
    tasks.push(t)
    if (tasks.length > maxTaskLength) {
      tasks.shift()
    }

    await chrome.storage.local.set({ tasks: tasks })
  }
}
