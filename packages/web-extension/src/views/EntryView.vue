<template>
  <div class="page-bg" v-if="isLogin">
    <section id="main-section">
      <header class="tab-bar row">
        <div
          @click="currentTab = tab.tab"
          :class="{
            tab: true,
            col: true,
            current: currentTab == tab.tab,
          }"
          v-for="tab in tabs"
          :key="tab.name"
        >
          <img class="icon fit-dpi" :src="tab.icon" />
          <span>
            <i class="badge tools-badge default-badge hide"></i>
            <i class="badge tools-badge text-badge hide"></i>
            {{ tab.name }}
          </span>
        </div>
      </header>
      <section id="tab-content-wrap">
        <div
          class="alert alert-warning mr-3 ml-3 mt-4"
          role="alert"
          v-if="hasUpdate"
        >
          <button
            type="button"
            class="close"
            data-dismiss="alert"
            aria-label="Close"
            @click="dontShowNotify"
          >
            <span aria-hidden="true">&times;</span>
          </button>
          <h4 class="alert-heading">新版本！</h4>
          <template v-if="remoteStatus.html">
            <div v-html="remoteStatus.html"></div>
          </template>
          <template v-if="!remoteStatus.html">
            <p>
              {{ remoteStatus.desc }}
              <a
                href="https://www.wechatsync.com/?utm_source=version_notify"
                target="_blank"
                >下载最新版本</a
              >
            </p>
          </template>
        </div>

        <div
          class="alert alert-secondary mr-3 ml-3 mt-4"
          role="alert"
          v-if="!dismiss_donate"
        >
          <button
            type="button"
            class="close"
            data-dismiss="alert"
            aria-label="Close"
            @click="dontShowNotify"
          >
            <span aria-hidden="true">&times;</span>
          </button>
          <h4 class="alert-heading">谢谢支持！</h4>
          <p>
            如果觉得本工具不错，还请分享给你的朋友！！<br />
            如果你是开发者、欢迎参与进来<a
              href="https://github.com/wechatsync/Wechatsync/blob/master/CONTRIBUTING.md"
              target="_blank"
              >wechatsync/Wechatsync</a
            >
          </p>
          <p>
            使用教程:
            <a
              href="https://www.wechatsync.com/blog/?utm_source=tip"
              target="_blank"
              >传送门</a
            >
          </p>
          <hr />
          <p class="mb-0 text-right">
            by
            <a
              href="https://blog.dev4eos.com/about/?utm_source=syncslogon"
              target="_blank"
              >fun</a
            >
          </p>
        </div>

        <section v-if="currentTab == 'account'">
          <div
            class="alert alert-warning mr-3 ml-3 mt-4"
            role="alert"
            v-if="reachLimit"
          >
            <button
              type="button"
              class="close"
              data-dismiss="alert"
              aria-label="Close"
              @click="dontShowNotify"
            >
              <span aria-hidden="true">&times;</span>
            </button>
            <h4 class="alert-heading">免费额度已用完！</h4>
            <p>如需继续使用请购买会员!</p>

            <p>19.99￥ / 1个月</p>

            <a
              href="https://mianbaoduo.com/product/show/mbd-Yp6W"
              @click="startPurchase"
              target="_blank"
              class="mt-2"
              >点击购买</a
            >

            <div v-if="onPurchase" class="mt-4">
              <h6>
                交易签名
                <span style="font-size: 12px; margin-left: 10px"
                  >支付成功后在底部可看到</span
                >
              </h6>
              <input
                type="email"
                v-model="orderSign"
                class="form-control"
                placeholder="签名"
              />
              <button
                type="submit"
                class="btn btn-primary mt-3 mb-1"
                @click="purchaseVip"
              >
                成为会员
              </button>
            </div>
          </div>

          <div class="account-list">
            <ul class="account-types" style="padding-bottom: 50px">
              <li v-for="account in accounts">
                <a :href="account.home" target="_blank">
                  <img
                    :src="account.avatar || account.icon || '/images/wordpress.ico'"
                    class="icon"
                    height="20"
                  />
                  {{ account.title }}
                </a>
                <!-- <img src="/images/arrow-right-light.png" style="float: right;"> -->
              </li>
              <li v-if="loading">数据加载中...</li>
            </ul>
          </div>
          <div class="tool-bottom">
            <button
              class="btn btn-outline-info"
              type="button"
              style="margin-right: 10px"
              @click="writeArticle()"
            >
              交流群
            </button>

            <button
              class="btn btn-outline-secondary"
              type="button"
              style="margin-right: 10px"
              @click="faq()"
            >
              问题反馈
            </button>

            <button
              class="btn btn-outline-secondary"
              type="button"
              style="margin-right: 10px"
              @click="howtouse()"
            >
              如何使用
            </button>

            <!-- <button
            class="btn btn-outline-secondary"
            type="button"
            style="margin-right: 10px"
            @click="goDonate()"
          >
            捐赠
          </button> -->

            <button
              class="btn btn-outline-secondary float-right"
              type="button"
              @click="$router.push({ name: 'AddAccount' })"
            >
              添加账号
            </button>
          </div>
        </section>
        <section v-if="currentTab == 'tool'">
          <div class="account-list">
            <ul class="account-types mb-2">
              <li
                class="media"
                v-for="(task, index) in tasks"
                @click="openTask(task, index)"
              >
                <img
                  class="align-self-center mr-3"
                  :src="task.post.thumb"
                  width="100"
                />
                <div class="media-body">
                  <h6 class="mt-0 mb-2">{{ task.post.title }}</h6>
                  <span v-if="task.status == 'wait'" class="badge badge-dark"
                    >等待</span
                  >
                  <span
                    v-if="task.status == 'uploading'"
                    class="badge badge-info"
                    >发布中</span
                  >
                  <span v-if="task.status == 'done'" class="badge badge-success"
                    >已完成</span
                  >
                  <span
                    v-if="task.status == 'failed'"
                    class="badge badge-danger"
                    >失败</span
                  >
                </div>
              </li>
            </ul>
            <div v-if="tasks.length == 0" class="ml-3 pb-2 mt-2">暂无数据</div>
            <div v-if="tasks.length > 10" class="ml-3 pb-2">
              只存储最近100条
            </div>
          </div>
        </section>
        <section v-if="currentTab == 'about'">
          <div style="text-align: center; padding-top: 30px">
            <a
              href="https://www.wechatsync.com/?utm_source=extension_about"
              target="_blank"
              ><img src="/images/logo.png" height="60" /> <br />
              <p style="font-size: 22px; color: #222">文章同步助手</p></a
            >
            <div style="color: #777; margin-top: 50px">
              <p>插件版本：{{ currentVersion }}</p>
              <p v-if="driverVersion">内核版本： {{ driverVersion.version }}</p>
              <p>
                Github:
                <a
                  href="https://github.com/wechatsync/Wechatsync"
                  target="_blank"
                  >wechatsync/Wechatsync</a
                >
              </p>
              <p>
                官网:
                <a
                  href="https://www.wechatsync.com/?utm_source=extension_about"
                  target="_blank"
                  >https://www.wechatsync.com/</a
                >
              </p>
              <p>
                <a
                  href="https://developer.wechatsync.com/?utm_source=extension-about"
                  target="_blank"
                  class="mt-2 mr-2 btn btn-info"
                  >开发者工具</a
                >
                <a
                  href="https://dun.mianbaoduo.com/@fun"
                  target="_blank"
                  class="mt-2 btn btn-outline-secondary"
                  >请作者吃饭<span style="">😋</span></a
                >
              </p>
            </div>
          </div>
        </section>
      </section>
    </section>
  </div>
</template>
<script>
var userInfo = localStorage.getItem('userInfo')
import VersionChecker from './versionCheckver'
import { getDriverProvider } from '@/runtime'
import axios from 'axios'

var loginForm
var currentVersion = '1.0.12'
var checker = new VersionChecker()

if (userInfo == null) {
  userInfo = {
    _id: 'unknow',
  }
  console.log('start login')
} else {
  userInfo = JSON.parse(userInfo)
}

// var winBackgroundPage
// try {
//   if (typeof chrome !== 'undefined' && chrome.extension) {
//     winBackgroundPage = chrome.extension.getBackgroundPage()
//   }
// } catch (e) {}
// var db = winBackgroundPage.db;

export default {
  name: '',
  data() {
    return {
      accounts: [],
      tasks: [],
      taskDetail: {},
      loading: false,
      currentVersion: currentVersion,
      driverVersion: null,
      orderSign: '',
      hasUpdate: false,
      currentTab: localStorage.getItem('currentTab') || 'account',
      dismiss_donate: localStorage.getItem('dismiss_donate') || false,
      onPurchase: localStorage.getItem('onPurchase') || false,
      reachLimit: localStorage.getItem('reachLimit') || false,
      tabs: [
        {
          icon: '/images/progress.svg',
          tab: 'tool',
          name: '状态',
        },
        {
          icon: '/images/user-circle.svg',
          tab: 'account',
          name: '账号',
        },
        {
          icon: '/images/setting.svg',
          tab: 'about',
          name: '关于',
        },
        // {
        //     icon: '/images/setting.png',
        //     tab: 'setting',
        //     name: '设置'
        // },
      ],
      isLogin: true,
      updatingDriver: false,
      cats: {},
    }
  },

  watch: {
    async currentTab() {
      if (window.db) {
        this.tasks = (await window.db.getTasks()).reverse()
      }
      this.loadAccounts()
      localStorage.setItem('currentTab', this.currentTab)
    },
  },
  async mounted() {
    var userInfo = localStorage.getItem('userInfo')
    if (userInfo) {
      this.isLogin = true
    }
    if (window.db) {
      this.tasks = (await window.db.getTasks()).reverse()
    }
    this.loadAccounts()
    var self = this
    if (loginForm) {
      console.log('loginForm', loginForm)
      loginForm.on('login', function (userInfo) {
        localStorage.setItem('userInfo', JSON.stringify(userInfo))
        localStorage.setItem('token', JSON.stringify(userInfo.token))
        loginForm.hide()
        self.isLogin = true
      })
    }
    this.checkVewVersion()
    chrome.runtime.sendMessage({ action: 'getDriverMeta' }, (resp) => {
      this.driverVersion = resp
    })
    // this.checkRemoteDriver()
  },
  methods: {
    updateDriverWithSrc(bundleFile) {
      if (this.updatingDriver) return
      this.updatingDriver = true
      try {
        // var driverVersion = winBackgroundPage.currentDriver.getMeta()
        // var netVersion = driverVersion.versionNumber + 1
        // var nextVersionFile = `https://cdn.jsdelivr.net/gh/lljxx1/extension-libs@latest/syncr-${netVersion}.js`
        var script = document.createElement('script')
        script.onload = () => {
          this.updatingDriver = false
          if (window.driver) {
            var remoteDriver = getDriverProvider(window.driver)
            var driverMeta = remoteDriver.getMeta()
            console.log('new version found', driverMeta)
            chrome.storage.local.set(
              {
                driver: window.driver,
              },
              function () {
                console.log('driver seted')
                chrome.runtime.sendMessage({ action: 'reloadDriver' })
              }
            )
          }
        }

        script.onerror = () => {
          this.updatingDriver = false
          console.log('new version not found', netVersion, driverVersion)
        }

        script.src = bundleFile

        setTimeout(() => {
          document.body.appendChild(script)
        }, 3000)
      } catch (e) {
        console.log('checkRemoteDriver', e)
      }
      // this.updatingDriver = false
    },
    checkRemoteDriver() {
      console.log('checkRemoteDriver', window.remoteDriver)
      try {
        chrome.runtime.sendMessage(
          { action: 'getDriverMeta' },
          (driverVersion) => {
            var netVersion = driverVersion.versionNumber + 1
            var nextVersionFile = `https://cdn.jsdelivr.net/gh/lljxx1/extension-libs@latest/syncr-${netVersion}.js`
            this.updateDriverWithSrc(nextVersionFile)
          }
        )
      } catch (e) {
        console.log('checkRemoteDriver', e)
      }
      // getDriverProvider
    },
    howtouse() {
      this.syncArticle()
      setTimeout(() => {
        chrome.tabs.create({
          url: 'https://www.wechatsync.com/blog/?utm_source=how-to-use',
        })
      }, 3000)
    },
    faq() {
      chrome.tabs.create({
        url: 'https://support.qq.com/products/105772',
      })
    },
    syncArticle() {
      // alert("打开一篇公众号文章或任何文章页，即可看到同步按钮");
      this.$message(
        '打开一篇公众号文章，左上角标题旁可看到同步按钮。或者网页右键可以看到【提取正文并同步】'
      )
    },
    writeArticle() {
      chrome.tabs.create({
        url:
          'https://www.wechatsync.com/?utm_source=plugin&u=' +
          userInfo._id +
          '#group',
      })
    },
    goDonate() {
      chrome.tabs.create({
        url:
          'https://mianbaoduo.com/o/bread/mbd-YZeal5Y=?utm_source=' +
          userInfo._id,
      })
    },
    async purchaseVip() {
      try {
        var response = await axios.get(
          'http://funapi.gospely.com/wechatsync/purchase?sign=' +
            this.orderSign +
            '&user=' +
            userInfo._id
        )
        var data = response.data
        if (data.status == 1) {
          alert('您已成为会员')
          localStorage.removeItem('reachLimit')
          this.reachLimit = false
        }
        console.log(data)
      } catch (e) {}
    },

    startPurchase() {
      this.onPurchase = true
      localStorage.setItem('onPurchase', 1)
    },
    async checkVewVersion() {
      console.log('checkVewVersion')
      // this.hasUpdate = true;
      // this.remoteStatus = {
      //   version: "0.0.8",
      //   html: `<p>
      //       本项目为非营利性项目。广泛的用户群体是我维护的主要动力。
      //       <!-- <br> -->
      //       如果觉得不错还请分享给你的朋友！谢谢！
      //     </p>
      //     <hr />
      //     <p class="mb-0 text-right">by fun</p>`,
      //   desc:
      //     "今日头条同步失败更明确的提示、修复今日头条不因为要手机号验证不能直接发布的问题，改为同步过去是草稿、解决了微信如果有外链及视频会无法同步到今日头条情况"
      // };
      // return;
      var hasUpdate = await checker.compare(currentVersion)
      console.log('hasUpdate', hasUpdate)
      if (hasUpdate > 0) this.hasUpdate = true
      this.remoteStatus = checker.getStatus()

      if (this.driverVersion) {
        var driverHasUpdate = await checker.compare(
          this.driverVersion.version,
          'driverVersion'
        )
        if (driverHasUpdate > 0 && this.remoteStatus.driverUrl) {
          // updating
          this.updateDriverWithSrc(this.remoteStatus.driverUrl)
        }
      }
    },
    dontShowNotify() {
      localStorage.setItem('dismiss_donate', 1)
      this.dismiss_donate = 1
    },
    openTask(r, index) {
      console.log('openTask')
      this.$router.push({
        name: 'TaskDetail',
        query: {
          id: r.index,
        },
      })
    },
    async loadAccounts() {
      this.loading = true
      // Toast("获取账号列表...");
      // var accounts = winBackgroundPage.db.getAccounts()
      // var users = await winBackgroundPage.getPublicAccounts()
      // this.accounts = accounts.concat(users)
      // this.loading = false
      // console.log(users)

      chrome.runtime.sendMessage({ action: 'getAccount' }, (resp) => {
        this.accounts = resp
        this.loading = false
        console.log(resp)
      })
    },
  },
}
</script>

<style></style>
