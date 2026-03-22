import WxRequest from 'mina-request'

const app = getApp()

const wxRequest = new WxRequest({
  baseURL: 'http://172.24.99.16/20'
})

Page({
  data: {
    url: "/api/video/script",
    scriptContent: "",
    loading: false,
    request: "你现在请总结我们以上聊天内容，生成这个视频的脚本script."
    
  },

  async onLoad() {
    await this.initScriptPage();
  },

  async initScriptPage() {
    try {
      await this.ensureTaskDataReady();
      await this.sendTaskData();
    } catch (err) {
      console.error("页面初始化失败：", err);
      wx.showToast({
        title: "初始化失败",
        icon: "none"
      });
    }
  },

  async ensureTaskDataReady() {
    const taskData = app.globalData.task_data || {};

    if (taskData.openid) {
      return;
    }

    await new Promise((resolve, reject) => {
      let count = 0;
      const maxCount = 20;

      const timer = setInterval(() => {
        const currentTaskData = app.globalData.task_data || {};

        if (currentTaskData.openid) {
          clearInterval(timer);
          resolve();
          return;
        }

        count += 1;
        if (count >= maxCount) {
          clearInterval(timer);
          reject(new Error("openid 未初始化完成"));
        }
      }, 200);
    });
  },

  async sendTaskData() {
    if (this.data.loading) return;

    app.globalData.task_data.request = this.data.request;

    this.setData({
      loading: true
    });

    try {
      const taskData = app.globalData.task_data;
      const url = this.data.url;

      const resp = await wxRequest.get(url, {
        task_data: taskData
      });

      const responseData = resp && resp.data ? resp.data : {};
      const scriptContent = responseData.response || "";

      app.globalData.task_data.scriptContent = scriptContent;

      this.setData({
        scriptContent
      });
    } catch (err) {
      console.error("请求脚本失败：", err);
      wx.showToast({
        title: "请求失败",
        icon: "none"
      });
    } finally {
      this.setData({
        loading: false
      });
    }
  },

  async changeVersion() {
    await this.sendTaskData();
  },

  onScriptInput(e) {
    const value = e.detail.value;

    this.setData({
      scriptContent: value
    });

    app.globalData.task_data.scriptContent = value;
  },

  showMore() {
    wx.showActionSheet({
      itemList: ["复制脚本内容", "前往生成选项页"],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.setClipboardData({
            data: this.data.scriptContent || "",
            success() {
              wx.showToast({
                title: "已复制",
                icon: "success"
              });
            }
          });
        } else if (res.tapIndex === 1) {
          wx.navigateTo({
            url: "../v_config/v_config"
          });
        }
      }
    });
  },

  goConfigPage() {
    wx.navigateTo({
      url: "../v_config/v_config",
      fail(err) {
        console.error("跳转失败：", err);
        wx.showToast({
          title: "页面跳转失败",
          icon: "none"
        });
      }
    });
  },

  onShareAppMessage() {}
});
