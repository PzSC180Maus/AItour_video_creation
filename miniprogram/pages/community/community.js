const communityService = require("../../utils/communityService.js");
const profileStore = require("../../utils/profileStore.js");
const app = getApp();

Page({
  data: {
    activeTab: "post",
    pageSize: 10,
    postPage: 1,
    cardPage: 1,
    postList: [],
    cardList: [],
    postHasMore: true,
    cardHasMore: true,
    loading: false,
    currentListLength: 0,
    hasMore: true
  },

  onLoad() {
    this.refreshCurrent();
  },
  onPullDownRefresh() {
    this.refreshCurrent().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  syncListState() {
    const list =
      this.data.activeTab === "post" ? this.data.postList : this.data.cardList;
    const hasMore =
      this.data.activeTab === "post"
        ? this.data.postHasMore
        : this.data.cardHasMore;

    this.setData({
      currentListLength: list.length,
      hasMore
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;

    if (!tab || tab === this.data.activeTab) {
      return;
    }

    this.setData(
      {
        activeTab: tab
      },
      () => {
        const list = tab === "post" ? this.data.postList : this.data.cardList;
        this.syncListState();

        if (!list.length) {
          this.refreshCurrent();
        }
      }
    );
  },

  requestCommunityPost(page) {
    return communityService.apiCommunityPost({
      page,
      page_size: this.data.pageSize
    });
  },

  requestCommunityCard(page) {
    return communityService.apiCommunityCard({
      page,
      page_size: this.data.pageSize
    });
  },

  requestCurrentList(type, page) {
    return type === "post"
      ? this.requestCommunityPost(page)
      : this.requestCommunityCard(page);
  },

  refreshCurrent() {
    const type = this.data.activeTab;

    this.setData({ loading: true });

    return this.requestCurrentList(type, 1)
      .then((resp) => {
        const data = resp && resp.data ? resp.data : {};
        const list = Array.isArray(data.list) ? data.list : [];
        if (type === "post") {
          this.setData({
            postList: list,
            postPage: 1,
            postHasMore: list.length >= this.data.pageSize
          });
        } else {
          this.setData({
            cardList: list,
            cardPage: 1,
            cardHasMore: list.length >= this.data.pageSize
          });
        }
      })
      .catch((err) => {
        console.error("社区列表加载失败", err);
        wx.showToast({
          title: "列表加载失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ loading: false });
        this.syncListState();
      });
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) {
      return;
    }

    const type = this.data.activeTab;
    const nextPage =
      type === "post" ? this.data.postPage + 1 : this.data.cardPage + 1;

    this.setData({ loading: true });

    this.requestCurrentList(type, nextPage)
      .then((resp) => {
        const data = resp && resp.data ? resp.data : {};
        const list = Array.isArray(data.list) ? data.list : [];
        if (type === "post") {
          this.setData({
            postList: this.data.postList.concat(list),
            postPage: nextPage,
            postHasMore: list.length >= this.data.pageSize
          });
        } else {
          this.setData({
            cardList: this.data.cardList.concat(list),
            cardPage: nextPage,
            cardHasMore: list.length >= this.data.pageSize
          });
        }
      })
      .catch((err) => {
        console.error("更多内容加载失败", err);
        wx.showToast({
          title: "加载失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ loading: false });
        this.syncListState();
      });
  },

  getItem(type, index) {
    const list = type === "post" ? this.data.postList : this.data.cardList;
    return list[Number(index)];
  },

  openDetail(e) {
    const type = e.currentTarget.dataset.type;
    const index = e.currentTarget.dataset.index;
    const item = this.getItem(type, index);

    if (!item) {
      return;
    }

    app.globalData.community_current_item = item;

    wx.navigateTo({
      url:
        "/pages/detail/detail?type=" +
        type +
        "&target_id=" +
        encodeURIComponent(item.target_id || "") +
        "&id=" +
        encodeURIComponent(item.post_id || item.card_id || "")
    });
  },

  useCard(e) {
    const item = this.getItem("card", e.currentTarget.dataset.index);

    if (!item) {
      return;
    }

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
          title: "使用卡片失败",
          icon: "none"
        });
      });
  },

  usePostCard(e) {
    const item = this.getItem("post", e.currentTarget.dataset.index);

    if (!item || !item.card_id) {
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
        console.error("使用卡片失败", err);
        wx.showToast({
          title: "使用卡片失败",
          icon: "none"
        });
      });
  },

  favoriteItem(e) {
    const type = e.currentTarget.dataset.type;
    const item = this.getItem(type, e.currentTarget.dataset.index);
    const openid = app.globalData.task_data && app.globalData.task_data.openid;
    const id = type === "post" ? item && item.post_id : item && item.card_id;

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
  },

  goCardPublish() {
    wx.navigateTo({
      url: "/pages/card_publish/card_publish"
    });
  },

  goPostPublish() {
    app.globalData.task_data = {  
      card_id: ""
    };
    wx.navigateTo({
      url: "/pages/publish/publish"
    });
  },

  goProfile() {
    wx.navigateTo({
      url: "/pages/profile/profile"
    });
  }
});
