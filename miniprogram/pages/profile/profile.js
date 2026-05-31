const communityService = require("../../utils/communityService.js");
const profileStore = require("../../utils/profileStore.js");
const avatarStore = require("../../utils/avatarStore.js");
const app = getApp();

Page({
  data: {
    activeTab: "mypost",
    userInfo: {},
    profile: {
      openid: "",
      created_post_list: [],
      created_card_list: [],
      favorite_post_list: [],
      favorite_card_list: []
    },
    currentList: [],
    cache: {
      mypost: [],
      mycard: [],
      post_liked: [],
      card_liked: []
    },
    loading: false
  },

  onLoad() {
    this.setData({
      userInfo: app.globalData.userInfo || {}
    });
    this.loadProfile();
  },

  loadProfile() {
    const openid = app.globalData.task_data && app.globalData.task_data.openid;

    if (!openid) {
      wx.showToast({
        title: "用户未初始化",
        icon: "none"
      });
      return;
    }

    profileStore
      .ensureProfile(openid)
      .then((profile) => {
        this.setData({ profile });
        this.loadTab(this.data.activeTab);
      })
      .catch((err) => {
        console.error("profile 加载失败", err);
      });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;

    if (!tab || tab === this.data.activeTab) {
      return;
    }

    this.setData({ activeTab: tab }, () => {
      this.loadTab(tab);
    });
  },

  requestProfileList(tab, payload) {
    const map = {
      mypost: communityService.apiProfileMypost,
      mycard: communityService.apiProfileMycard,
      post_liked: communityService.apiProfilePostLiked,
      card_liked: communityService.apiProfileCardLiked
    };
    const request = map[tab];

    return request ? request(payload) : Promise.resolve({ data: { list: [] } });
  },

  attachAuthorProfiles(list) {
    const safeList = Array.isArray(list) ? list : [];
    const openids = safeList.map((item) => item && item.openid).filter(Boolean);

    if (!openids.length) {
      return Promise.resolve(safeList);
    }

    return profileStore
      .getProfilesByOpenids(openids)
      .then((profileMap) => {
        const normalizedProfiles = {};

        return Promise.all(
          Object.keys(profileMap).map((openid) => {
            const profile = profileMap[openid];

            return avatarStore
              .normalizeAvatar(profile.avatarUrl || "", profile.avatarFileID || "")
              .then((avatar) => {
                normalizedProfiles[openid] = {
                  ...profile,
                  avatarUrl: avatar.avatarUrl,
                  avatarFileID: avatar.avatarFileID
                };
              });
          })
        ).then(() =>
          safeList.map((item) => {
            const profile = normalizedProfiles[item.openid];

            if (!profile) {
              return item;
            }

            return {
              ...item,
              author_name: profile.nickName || item.author_name || "用户",
              author_avatar: profile.avatarUrl || item.author_avatar || ""
            };
          })
        );
      })
      .catch((err) => {
        console.error("空间作者资料补全失败", err);
        return safeList;
      });
  },

  getPayload(tab) {
    const openid = app.globalData.task_data && app.globalData.task_data.openid;

    if (tab === "mypost" || tab === "mycard") {
      return { openid };
    }

    if (tab === "post_liked") {
      return {
        post_list: this.data.profile.favorite_post_list || []
      };
    }

    return {
      card_list: this.data.profile.favorite_card_list || []
    };
  },

  loadTab(tab) {
    this.setData({ loading: true });

    const payload = this.getPayload(tab);

    this.requestProfileList(tab, payload)
      .then((resp) => {
        const data = resp && resp.data ? resp.data : {};
        const list = Array.isArray(data.list) ? data.list : [];
        return this.attachAuthorProfiles(list);
      })
      .then((list) => {
        const nextCache = {
          ...this.data.cache,
          [tab]: list
        };

        this.setData({
          cache: nextCache,
          currentList: list
        });
      })
      .catch((err) => {
        console.error("空间列表加载失败", err);
        wx.showToast({
          title: "加载失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  openDetail(e) {
    const item = this.data.currentList[Number(e.currentTarget.dataset.index)];

    if (!item) {
      return;
    }

    const type = item.post_id ? "post" : "card";
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

  goBack() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({
          url: "/pages/community/community"
        });
      }
    });
  },

  goCommunity() {
    wx.redirectTo({
      url: "/pages/community/community"
    });
  },

  goCreate() {
    wx.navigateTo({
      url: "/pages/scenery_select/scenery_select"
    });
  }
});
