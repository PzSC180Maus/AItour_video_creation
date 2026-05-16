// pages/mode_select/mode_select.js
const app = getApp();

Page({
  data: {},

  onLoad() {
    app.globalData.hasNavigated = true;
  },

  official() {
    wx.navigateTo({
      url: "../scenery_select/scenery_select",
    });
  },

  personalize() {
    wx.navigateTo({
      url: "../user_custom1/user_custom1",
    });
  },

  community() {
    wx.navigateTo({
      url: "../community/community",
    });
  },
});
