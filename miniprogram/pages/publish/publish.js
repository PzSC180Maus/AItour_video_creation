const communityService = require("../../utils/communityService.js");
const profileStore = require("../../utils/profileStore.js");
const app = getApp();

Page({
  data: {
    title: "",
    cardId: "",
    videoUrl: "",
    coverUrl: "",
    shareText: "",
    hasVideo: false,
    publishing: false
  },

  onLoad() {
    const taskData = app.globalData.task_data || {};
    const videoUrl = app.globalData.video_url || app.globalData.videoUrl || "";

    this.setData({
      title: "我的旅行作品",
      cardId: taskData.card_id || "",
      videoUrl,
      coverUrl: app.globalData.coverUrl || taskData.spot_url || "",
      shareText: app.globalData.final_response || "",
      hasVideo: !!videoUrl
    });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onShareInput(e) {
    this.setData({ shareText: e.detail.value });
  },

  goCreateVideo() {
    wx.navigateTo({
      url: "/pages/mode_select/mode_select"
    });
  },

  backToCommunity() {
    wx.redirectTo({
      url: "/pages/community/community"
    });
  },

  publishPost() {
    if (this.data.publishing) {
      return;
    }

    const taskData = app.globalData.task_data || {};
    const userInfo = app.globalData.userInfo || {};
    const openid = taskData.openid || "";

    if (!openid || !this.data.videoUrl) {
      wx.showToast({
        title: "缺少发布信息",
        icon: "none"
      });
      return;
    }

    this.setData({ publishing: true });

    communityService
      .apiCommunityPostPublish({
        openid,
        card_id: this.data.cardId || "none",
        author_name: userInfo.nickName || "用户",
        author_avatar: userInfo.avatarUrl || "",
        title: this.data.title || "旅行作品",
        cover_url: this.data.coverUrl || "",
        video_url: this.data.videoUrl,
        share_text: this.data.shareText || ""
      })
      .then((resp) => {
        const data = resp && resp.data ? resp.data : {};

        if (!data.success || !data.post_id) {
          throw new Error("post publish failed");
        }

        return profileStore.saveCreatedId(openid, "post", data.post_id);
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
        console.error("发布帖子失败", err);
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
