// app.js
App({
  onLaunch: function () {
    // 全局数据结构，在其它页面可通过 getApp().globalData 访问
    this.globalData = {
      env: "",      // 填写自己的环境ID
      openid: null,
      userInfo: null,
    };

    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }

    // 启动时就去取 openid
    this._getOpenId();

    // 如果已经授权，顺便取一下 userInfo
    this._getUserProfile();
  },

  /** 调用云函数获取 openid 并保存 */
  _getOpenId() {
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",   // 示例云函数名
        data: {
          type: "getOpenId",
        },
      })
      .then((resp) => {
        // 云函数返回 { openid, appid, unionid }
        this.globalData.openid = resp.result.openid;
        console.log("openid:", this.globalData.openid);
      })
      .catch((e) => {
        console.warn("getOpenId 失败", e);
      });
  },

  /**
   * 获取用户头像/昵称。
   * 1. 先用 wx.getSetting 看是否已经授权，
   * 2. 若授权则调用 wx.getUserProfile，结果存 globalData。
   * 可在页面 onReady/onLoad 调用 app.getUserInfo(cb) 以确保获得信息。
   */
  _getUserProfile() {
    const app = this;
    wx.getSetting({
      success(res) {
        if (res.authSetting["scope.userInfo"]) {
          wx.getUserProfile({
            desc: "用于完善会员资料",
            success(profile) {
              app.globalData.userInfo = profile.userInfo;
              console.log("userInfo:", app.globalData.userInfo);
            },
          });
        }
      },
    });
  },

  /** 页面调用的封装接口 */
  getUserInfo(cb) {
    if (this.globalData.userInfo) {
      typeof cb === "function" && cb(this.globalData.userInfo);
    } else {
      this._getUserProfile();
      // 获取完成后再回调
      // 也可以在 _getUserProfile 成功回调里直接执行 cb
    }
  },
});
