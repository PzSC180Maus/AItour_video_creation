// pages/dialogue/dialogue.js
import WxRequest from "mina-request";

const app = getApp();

const wxRequest = new WxRequest({
  baseURL: "http://172.24.99.16/20"
});

const DEFAULT_USER_AVATAR = "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";

Page({
  data: {
    initUrl: "api/dialogue/init",
    chatUrl: "api/dialogue/chat",
    inputValue: "",
    loading: false,
    initialized: false,
    showBotTyping: false,
    bot_avatar: "https://img.tukuppt.com/ad_preview/08/91/03/64daf3937a984.jpg!/fw/780",
    bot_name: "智能助手",
    user_avatar: DEFAULT_USER_AVATAR,
    user_name: "用户",
    messages: []
  },

  async onLoad() {
    this.syncUserInfo();

    this.setData({
      initialized: false,
      showBotTyping: true
    });

    try {
      await this.ensureTaskDataReady();
      await this.sendInitialDialogueRequest();
      this.setData({
        initialized: true
      });
    } catch (err) {
      console.error("对话页初始化失败：", err);
      wx.showToast({
        title: "初始化失败，可手动继续对话",
        icon: "none"
      });

      this.setData({
        initialized: true,
        loading: false,
        showBotTyping: false
      });
    }
  },

  syncUserInfo() {
    const userInfo = app.globalData.userInfo || {};

    this.setData({
      user_avatar: userInfo.avatarUrl || DEFAULT_USER_AVATAR,
      user_name: userInfo.nickName || "用户"
    });
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

  async sendRequest(url, requestText, options = {}) {
    const { appendUserMessage = false, clearInput = false } = options;

    if (this.data.loading) {
      return;
    }

    if (!requestText) {
      wx.showToast({
        title: "请求内容为空",
        icon: "none"
      });
      return;
    }

    const taskData = {
      ...(app.globalData.task_data || {}),
      request: requestText
    };

    const nextMessages = appendUserMessage
      ? this.data.messages.concat([{
          role: "user",
          content: requestText,
          avatar: this.data.user_avatar,
          name: this.data.user_name
        }])
      : this.data.messages.slice();

    this.setData({
      loading: true,
      showBotTyping: true,
      messages: nextMessages,
      inputValue: clearInput ? "" : this.data.inputValue
    });

    try {
      const resp = await wxRequest.post(url, {
        task_data: taskData
      });

      const replyText =
        typeof resp.data === "string"
          ? resp.data
          : (resp.data && resp.data.response) || "";

      const botMessage = {
        role: "bot",
        content: replyText,
        avatar: this.data.bot_avatar,
        name: this.data.bot_name
      };

      app.globalData.task_data = taskData;

      this.setData({
        messages: this.data.messages.concat([botMessage]),
        showBotTyping: false
      });
    } catch (err) {
      console.error("请求后端失败：", err);
      wx.showToast({
        title: "请求失败",
        icon: "none"
      });
    } finally {
      this.setData({
        loading: false,
        showBotTyping: false
      });
    }
  },

  async sendInitialDialogueRequest() {
    const taskData = app.globalData.task_data || {};
    const requestText = taskData.request || "";

    await this.sendRequest(this.data.initUrl, requestText, {
      appendUserMessage: false,
      clearInput: false
    });
  },

  async sendUserDialogueRequest(text) {
    await this.sendRequest(this.data.chatUrl, text, {
      appendUserMessage: true,
      clearInput: true
    });
  },

  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  async sendUserMessage() {
    if (!this.data.initialized || this.data.loading) {
      return;
    }

    const text = (this.data.inputValue || "").trim();

    if (!text) {
      wx.showToast({
        title: "请输入内容",
        icon: "none"
      });
      return;
    }

    await this.sendUserDialogueRequest(text);
  },

  finishDrawing() {
    wx.navigateTo({
      url: "../script/script",
      fail(err) {
        console.error("跳转 script 失败：", err);
        wx.showToast({
          title: "页面跳转失败",
          icon: "none"
        });
      }
    });
  }
});