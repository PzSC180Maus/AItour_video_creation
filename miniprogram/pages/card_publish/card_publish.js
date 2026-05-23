const communityService = require("../../utils/communityService.js");
const profileStore = require("../../utils/profileStore.js");
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

  normalizeAvatarUrl(avatarUrl) {
    if (!avatarUrl) {
      return Promise.resolve("");
    }

    if (/^https?:\/\//.test(avatarUrl) && !avatarUrl.startsWith("http://tmp/")) {
      return Promise.resolve(avatarUrl);
    }

    return wx.cloud
      .uploadFile({
        cloudPath: "community-avatar-" + Date.now() + ".jpg",
        filePath: avatarUrl
      })
      .then((uploadRes) =>
        wx.cloud.getTempFileURL({
          fileList: [uploadRes.fileID]
        })
      )
      .then((urlRes) => {
        const item = urlRes.fileList && urlRes.fileList[0];
        const tempFileURL = item && item.tempFileURL;

        if (!tempFileURL) {
          throw new Error("missing avatar temp file url");
        }

        return tempFileURL;
      });
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

    this.normalizeAvatarUrl(userInfo.avatarUrl || "")
      .then((authorAvatar) =>
        communityService.apiCommunityCardPublish({
          openid,
          author_name: userInfo.nickName || "用户",
          author_avatar: authorAvatar,
          image_url: this.data.imageUrl,
          emotion_text: this.data.emotionText
        })
      )
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
