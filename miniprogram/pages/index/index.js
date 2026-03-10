// index.js
const util = require("../../utils/util.js");
const app = getApp();

Page({
  data: {
    logs: [],
    openid: "",
    motto: "Your Story, Our Scenery",
    userInfo: {
      avatarUrl: "",
      nickName: "",
    },
    hasUserInfo: false,
    canIUseGetUserProfile: wx.canIUse("getUserProfile"),
    canIUseNicknameComp: wx.canIUse("input.type.nickname"),
  },

  onLoad() {
    this.setData({
      logs: (wx.getStorageSync("logs") || []).map((log) => {
        return {
          date: util.formatTime(new Date(log)),
          timeStamp: log,
        };
      }),
      openid: app.globalData.openid || "",
    });
  },

  bindViewTap() {
    wx.navigateTo({
      url: "../logs/logs",
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const { nickName } = this.data.userInfo;
    this.setData({
      "userInfo.avatarUrl": avatarUrl,
      hasUserInfo:
        nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
    });
  },

  onInputChange(e) {
    const nickName = e.detail.value;
    const { avatarUrl } = this.data.userInfo;
    this.setData({
      "userInfo.nickName": nickName,
      hasUserInfo:
        nickName && avatarUrl && avatarUrl !== defaultAvatarUrl,
    });
  },

  getUserProfile(e) {
    // 封装调用 app.getUserInfo，结果会同步到全局
    app.getUserInfo((userInfo) => {
      this.setData({
        userInfo,
        hasUserInfo: true,
      });
    });
  },
});

const defaultAvatarUrl =
  "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";


