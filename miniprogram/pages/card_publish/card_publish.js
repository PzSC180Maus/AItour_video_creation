const communityService = require("../../utils/communityService.js");
const profileStore = require("../../utils/profileStore.js");
const avatarStore = require("../../utils/avatarStore.js");
const app = getApp();

Page({
  data: {
    imageUrl: "",
    emotionText: "",
    publishing: false
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        const path = file && file.tempFilePath;

        if (!path) {
          return;
        }

        wx.showLoading({ title: "上传中..." });
        wx.cloud
          .uploadFile({
            cloudPath: "community-card-" + Date.now() + ".png",
            filePath: path
          })
          .then((uploadRes) =>
            wx.cloud.getTempFileURL({
              fileList: [uploadRes.fileID]
            })
          )
          .then((urlRes) => {
            const item = urlRes.fileList && urlRes.fileList[0];
            const imageUrl = item && item.tempFileURL;
            if (!imageUrl) {
              throw new Error("missing temp file url");
            }

            this.setData({ imageUrl });
          })
          .catch((err) => {
            console.error("卡片图片上传失败", err);
            wx.showToast({
              title: "上传失败",
              icon: "none"
            });
          })
          .finally(() => {
            wx.hideLoading();
          });
      }
    });
  },

  onTextInput(e) {
    this.setData({ emotionText: e.detail.value });
  },

  publishCard() {
    if (this.data.publishing) {
      return;
    }

    const taskData = app.globalData.task_data || {};
    const userInfo = app.globalData.userInfo || {};
    const openid = taskData.openid || "";

    if (!openid || !this.data.imageUrl || !this.data.emotionText.trim()) {
      wx.showToast({
        title: "请补全卡片信息",
        icon: "none"
      });
      return;
    }

    this.setData({ publishing: true });

    avatarStore
      .saveUserInfo(openid, userInfo)
      .then((savedUserInfo) => {
        app.globalData.userInfo = savedUserInfo;

        return communityService.apiCommunityCardPublish({
          openid,
          author_name: savedUserInfo.nickName || "用户",
          author_avatar: savedUserInfo.avatarUrl || "",
          image_url: this.data.imageUrl,
          emotion_text: this.data.emotionText
        });
      })
      .then((resp) => {
        const data = resp && resp.data ? resp.data : {};

        if (!data.success || !data.card_id) {
          throw new Error("card publish failed");
        }

        return profileStore.saveCreatedId(openid, "card", data.card_id);
      })
      .then(() => {
        wx.showToast({
          title: "发布成功",
          icon: "success"
        });
        wx.redirectTo({
          url: "/pages/community/community"
        });
      })
      .catch((err) => {
        console.error("发布卡片失败", err);
        wx.showToast({
          title: "发布失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ publishing: false });
      });
  }
});
