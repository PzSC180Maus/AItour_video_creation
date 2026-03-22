// pages/v_config/v_config.js
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})
Page({
  data: {
    avatarUrl: ''
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.showToast({
          title: '当前没有上一页',
          icon: 'none'
        });
      }
    });
  },

  showMore() {
    wx.showActionSheet({
      itemList: ['重新上传肖像', '返回脚本页'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseAndUploadImage();
        } else if (res.tapIndex === 1) {
          wx.navigateBack({
            fail() {
              wx.navigateTo({
                url: '/pages/script/script'
              });
            }
          });
        }
      }
    });
  },

  chooseAndUploadImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          avatarUrl: tempFilePath
        });

        wx.showToast({
          title: '图片已上传',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '未选择图片',
          icon: 'none'
        });
      }
    });
  },

  tapOption(e) {
    const name = e.currentTarget.dataset.name || '已选择';
    wx.showToast({
      title: name,
      icon: 'none'
    });
  },

  generateVideo() {
    if (!this.data.avatarUrl) {
      wx.showToast({
        title: '请先上传个人肖像',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '视频生成中...'
    });

    setTimeout(() => {
      wx.hideLoading();
      wx.showModal({
        title: '生成结果',
        content: '演示版：视频已生成成功',
        showCancel: false
      });
    }, 1800);
  }
});