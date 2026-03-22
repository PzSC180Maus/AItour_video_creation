// pages/result/result.js
const app = getApp();

Page({
  data: {
    videoUrl: "",
    coverUrl: "",
    finalResponse: ""
  },

  onLoad() {
    const taskData = app.globalData.task_data || {};

    this.setData({
      videoUrl: app.globalData.video_url || app.globalData.videoUrl || "",
      coverUrl: taskData.spot_url || "",
      finalResponse: app.globalData.final_response || ""
    });
  },

  backToGenerate() {
    wx.redirectTo({
      url: "/pages/script/script"
    });
  },

  saveVideo() {
    const videoUrl = this.data.videoUrl;

    if (!videoUrl) {
      wx.showToast({
        title: "暂未获取到视频地址",
        icon: "none"
      });
      return;
    }

    wx.showLoading({
      title: "下载中..."
    });

    wx.downloadFile({
      url: videoUrl,
      success(res) {
        if (res.statusCode === 200) {
          wx.saveVideoToPhotosAlbum({
            filePath: res.tempFilePath,
            success() {
              wx.hideLoading();
              wx.showToast({
                title: "已保存到相册",
                icon: "success"
              });
            },
            fail() {
              wx.hideLoading();
              wx.showToast({
                title: "保存失败或未授权",
                icon: "none"
              });
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: "下载失败",
            icon: "none"
          });
        }
      },
      fail() {
        wx.hideLoading();
        wx.showToast({
          title: "下载失败",
          icon: "none"
        });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: "这是我生成的视频，快来看看",
      path: "/pages/dialogue/dialogue"
    };
  }
});