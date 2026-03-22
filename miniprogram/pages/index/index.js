// index.js
const util = require("../../utils/util.js");
const app = getApp();

const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    logs: [],
    motto: "Your Story, Our Scenery",
    userInfo: {
      avatarUrl: defaultAvatarUrl,
      nickName: "",
    },
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse("getUserProfile"),
    canIUseNicknameComp: wx.canIUse("input.type.nickname"),
    canIUseChooseAvatar: wx.canIUse("chooseAvatar"),
  },

  onLoad() {
    this.setData({
      logs: (wx.getStorageSync("logs") || []).map((log) => {
        return {
          date: util.formatTime(new Date(log)),
          timeStamp: log,
        };
      }),
    });
  },

  onShow() {
    console.log('onShow triggered, hasNavigated:', app.globalData.hasNavigated, 'globalData:', app.globalData);
    if (app.globalData.hasNavigated) {
      console.log('Before reset:', this.data.userInfo);
    this.setData({
      userInfo: {
        avatarUrl: defaultAvatarUrl,
        nickName: "",
      },
      hasUserInfo: false,
    });
    console.log('After reset:', this.data.userInfo);
    app.globalData.userInfo = this.data.userInfo;
    app.globalData.hasNavigated = false;// 重置逻辑
    }
  },

  bindViewTap() {
    wx.navigateTo({
      url: "../logs/logs",
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    const { nickName } = this.data.userInfo
    const hasUserInfo = nickName && avatarUrl && avatarUrl !== defaultAvatarUrl;
    this.setData({
      "userInfo.avatarUrl": avatarUrl,
      hasUserInfo: hasUserInfo,
    })
    if (hasUserInfo) {
      console.log('Setting hasNavigated to true');
      app.globalData.hasNavigated = true;
      app.globalData.userInfo = this.data.userInfo;
      wx.navigateTo({
        url: '../mode_select/mode_select'
      });
    }
  },

  onInputChange(e) {
    const nickName = e.detail.value;
    const newUserInfo = { ...this.data.userInfo, nickName };
    const hasUserInfo = nickName && newUserInfo.avatarUrl && newUserInfo.avatarUrl !== defaultAvatarUrl;
    this.setData({ 
      userInfo: newUserInfo,
      hasUserInfo: hasUserInfo, 
    });
    app.globalData.userInfo = newUserInfo;
  
    if (hasUserInfo) {
      console.log('Setting hasNavigated to true');
      app.globalData.hasNavigated = true;
      wx.navigateTo({
        url: '../mode_select/mode_select'
      });
    }
  },

  getUserProfile(e) {
    app.getUserInfo((userInfo) => {
      this.setData({
        userInfo: userInfo,
        hasUserInfo: true,
      });
      app.globalData.userInfo = userInfo;
      wx.navigateTo({
        url: '../mode_select/mode_select'
      });
    });
  },
});



