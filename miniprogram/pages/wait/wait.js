// pages/generating/generating.js
import WxRequest from "mina-request";

const app = getApp();

const wxRequest = new WxRequest({
  baseURL: "http://172.24.99.16/20"
});

Page({
  data: {
    coverUrl: "",
    progress: 0,
    videoStatus: false,
    pollingTimer: null,
    fakeTimer: null,
    requestUrl: "/api/video/script"
  },

  onLoad() {
    const taskData = app.globalData.task_data || {};

    this.setData({
      coverUrl: taskData.spot_url || taskData.user_potrait || ""
    });

    this.startFakeProgress();
    this.startTaskFlow();
  },

  onUnload() {
    this.clearPolling();
    this.clearFakeProgress();
  },

  async startTaskFlow() {
    const taskData = app.globalData.task_data || {};

    if (!taskData.openid) {
      wx.showToast({
        title: "openid 未初始化完成",
        icon: "none"
      });
      return;
    }

    wx.showLoading({
      title: "任务提交中..."
    });

    // 第一步：先发第一个请求，失败也不阻断
    try {
      const firstResp = await wxRequest.get(this.data.requestUrl, {
        task_data: taskData
      });

      const firstData = firstResp && firstResp.data ? firstResp.data : {};
      const finalResponse =
        typeof firstData === "string"
          ? firstData
          : firstData.response || firstData.final_response || "";

      app.globalData.final_response = finalResponse;
    } catch (err) {
      console.error("第一个任务失败：", err);
    }

    // 第二步：无论第一个是否失败，都继续发第二个请求
    try {
      const secondTaskData = {
        ...taskData,
        sign: 2
      };

      await wxRequest.get(this.data.requestUrl, {
        task_data: secondTaskData
      });

      wx.hideLoading();
      this.startPolling();
    } catch (err) {
      wx.hideLoading();
      console.error("第二个任务启动失败：", err);
      wx.showToast({
        title: "视频任务启动失败",
        icon: "none"
      });
    }
  },

  startPolling() {
    if (this.data.pollingTimer) {
      return;
    }

    const timer = setInterval(() => {
      this.checkVideoStatus();
    }, 2000);

    this.setData({
      pollingTimer: timer
    });
  },

  clearPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.setData({
        pollingTimer: null
      });
    }
  },

  startFakeProgress() {
    if (this.data.fakeTimer) {
      return;
    }

    const timer = setInterval(() => {
      const current = this.data.progress || 0;
      let next = current + Math.floor(Math.random() * 6) + 1;

      if (next >= 95) {
        next = 95;
      }

      this.setData({
        progress: next
      });

      // 到 95 就停住，等待真正完成时再拉到 100
      if (next >= 95) {
        this.clearFakeProgress();
      }
    }, 600);

    this.setData({
      fakeTimer: timer
    });
  },

  clearFakeProgress() {
    if (this.data.fakeTimer) {
      clearInterval(this.data.fakeTimer);
      this.setData({
        fakeTimer: null
      });
    }
  },

  async checkVideoStatus() {
    try {
      const taskData = app.globalData.task_data || {};

      const pollingTaskData = {
        openid: taskData.openid,
        sign: 2
      };

      const resp = await wxRequest.get(this.data.requestUrl, {
        task_data: pollingTaskData
      });

      const rawData = resp && resp.data ? resp.data : {};
      const videoResponse = rawData.video_response || rawData;

      const videoStatus = videoResponse.video_status === true;
      const videoUrl = videoResponse.video_url || "";

      if (typeof videoResponse.progress === "number") {
        this.setData({
          progress: videoResponse.progress > 100 ? 100 : videoResponse.progress
        });
      }

      if (videoStatus && videoUrl) {
        this.handleVideoReady(videoUrl, videoResponse);
      }
    } catch (err) {
      console.error("轮询视频状态失败：", err);
    }
  },

  handleVideoReady(videoUrl, videoResponse = {}) {
    this.clearPolling();
    this.clearFakeProgress();

    this.setData({
      progress: 100,
      videoStatus: true
    });

    app.globalData.video_url = videoUrl;
    app.globalData.videoUrl = videoUrl;

    if (videoResponse.cover_url) {
      app.globalData.coverUrl = videoResponse.cover_url;
    }

    setTimeout(() => {
      wx.navigateTo({
        url: "/pages/v_output/v_output"
      });
    }, 400);
  }
});