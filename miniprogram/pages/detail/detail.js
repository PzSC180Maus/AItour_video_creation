const communityService = require("../../utils/communityService.js");
const commentStore = require("../../utils/commentStore.js");
const profileStore = require("../../utils/profileStore.js");
const avatarStore = require("../../utils/avatarStore.js");
const app = getApp();

Page({
  data: {
    type: "post",
    id: "",
    targetId: "",
    item: {},
    target: {
      likes: 0,
      favorites: 0,
      comments: 0,
      List: []
    },
    commentInput: "",
    commentLoading: false,
    commenting: false
  },

  normalizeTarget(target) {
    const safeTarget = target || {};

    return {
      likes: safeTarget.likes || 0,
      favorites: safeTarget.favorites || 0,
      comments: safeTarget.comments || 0,
      List: Array.isArray(safeTarget.List) ? safeTarget.List : []
    };
  },

  onLoad(options) {
    const item = app.globalData.community_current_item || {};
    const target = item.target || item.Target || {};
    const type = options.type || item.type || "post";
    const id = options.id || item.post_id || item.card_id || "";

    this.setData({
      type,
      id,
      targetId: options.target_id || item.target_id || "",
      item,
      target: this.normalizeTarget(target)
    });

    this.loadComments();
  },

  getCommentTargetId() {
    const item = this.data.item || {};

    return (
      this.data.targetId ||
      item.target_id ||
      item.comment_id ||
      item.post_id ||
      item.card_id ||
      this.data.id
    );
  },

  loadComments() {
    const targetId = this.getCommentTargetId();

    if (!targetId) {
      return Promise.resolve([]);
    }

    this.setData({ commentLoading: true });

    return commentStore
      .listByTarget(targetId)
      .then((comments) => {
        this.setData({
          target: {
            ...this.data.target,
            comments: comments.length,
            List: comments
          }
        });
        return comments;
      })
      .catch((err) => {
        console.error("评论加载失败", err);
        wx.showToast({
          title: "评论加载失败",
          icon: "none"
        });
        return [];
      })
      .finally(() => {
        this.setData({ commentLoading: false });
      });
  },

  onCommentInput(e) {
    this.setData({
      commentInput: e.detail.value
    });
  },

  submitComment() {
    if (this.data.commenting) {
      return;
    }

    const content = (this.data.commentInput || "").trim();
    const targetId = this.getCommentTargetId();
    const openid = app.globalData.task_data && app.globalData.task_data.openid;
    const userInfo = app.globalData.userInfo || {};

    if (!openid || !targetId || !content) {
      wx.showToast({
        title: "请先填写评论",
        icon: "none"
      });
      return;
    }

    this.setData({ commenting: true });

    avatarStore
      .saveUserInfo(openid, userInfo)
      .then((savedUserInfo) => {
        app.globalData.userInfo = savedUserInfo;

        return commentStore.addComment({
          target_id: targetId,
          target_type: this.data.type,
          author_openid: openid,
          author_name: savedUserInfo.nickName || "用户",
          author_avatar: savedUserInfo.avatarUrl || "",
          content
        });
      })
      .then(() => {
        this.setData({ commentInput: "" });
        return this.loadComments();
      })
      .catch((err) => {
        console.error("评论发布失败", err);
        wx.showToast({
          title: "评论发布失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ commenting: false });
      });
  },

  useCard() {
    const item = this.data.item || {};

    communityService
      .apiCommunityCardUse({
        card_id: item.card_id
      })
      .then((resp) => {
        const data = resp && resp.data ? resp.data : {};
        const card = data.card || data || item;

        app.globalData.task_data.spot_url = card.image_url || item.image_url || "";
        app.globalData.task_data.request =
          card.emotion_text || item.emotion_text || "";
        app.globalData.task_data.card_id = item.card_id || "";

        wx.navigateTo({
          url: "/pages/dialogue/dialogue"
        });
      })
      .catch((err) => {
        console.error("使用卡片失败", err);
        wx.showToast({
          title: "使用失败",
          icon: "none"
        });
      });
  },

  usePostCard() {
    const item = this.data.item || {};

    if (!item.card_id) {
      wx.showToast({
        title: "暂无绑定卡片",
        icon: "none"
      });
      return;
    }

    communityService
      .apiCommunityCardUse({
        card_id: item.card_id
      })
      .then((resp) => {
        const data = resp && resp.data ? resp.data : {};

        const card = data.card || data || {};

        app.globalData.task_data.spot_url = card.image_url || "";
        app.globalData.task_data.request = card.emotion_text || "";
        app.globalData.task_data.card_id = item.card_id || "";

        wx.navigateTo({
          url: "/pages/dialogue/dialogue"
        });
      })
      .catch((err) => {
        console.error("使用绑定卡片失败", err);
        wx.showToast({
          title: "使用失败",
          icon: "none"
        });
      });
  },

  favoriteCurrent() {
    const openid = app.globalData.task_data && app.globalData.task_data.openid;
    const item = this.data.item || {};
    const type = this.data.type;
    const id = type === "post" ? item.post_id : item.card_id;

    if (!openid || !id) {
      wx.showToast({
        title: "暂不能收藏",
        icon: "none"
      });
      return;
    }

    profileStore
      .toggleFavorite(openid, type, id)
      .then((res) => {
        wx.showToast({
          title: res.isFavorited ? "已收藏" : "已取消",
          icon: "success"
        });
      })
      .catch((err) => {
        console.error("收藏失败", err);
        wx.showToast({
          title: "收藏失败",
          icon: "none"
        });
      });
  }
});
