// pages/wait/wait.js
import WxRequest from "mina-request";

const app = getApp();

const wxRequest = new WxRequest({
  baseURL: "https://ruralv.cn"
});

Page({
  data: {
    use_extend: false,
    count: 0,
    coverUrl: "",
    progress: 0,
    videoStatus: "idle",
    pollingTimer: null,
    fakeTimer: null,
    requestUrl: "/api/share",
    extendURL: "/api/video/extend",
    videoReq: "/api/video",
    videoStatusUrl: "/api/video/status"
  },

  onLoad() {
    const taskData = app.globalData.task_data || {};

    this.setData({
      use_extend: app.globalData.video_extend || false,
      count: app.globalData.task_data.count || 0,
      coverUrl: taskData.spot_url || taskData.user_potrait || ""
    });
    setTimeout(() => {
      this.startFakeProgress();
      this.startTaskFlow();
    }, 200);
  },

  onUnload() {
    this.clearPolling();
    this.clearFakeProgress();
  },

  async startTaskFlow() {
    console.log("轮询使用的 task_data:", app.globalData.task_data);
    const taskData = app.globalData.task_data || {};

    if (!taskData.openid || !taskData.task_id) {
      wx.showToast({
        title: "任务未初始化",
        icon: "none"
      });
      return;
    }

    wx.showLoading({
      title: "任务提交中..."
    });

    const fullTaskData = { ...taskData };

    try {
      const shareResp = await wxRequest.post(this.data.requestUrl, {
        task_data: fullTaskData
      });

      const shareData = shareResp && shareResp.data ? shareResp.data : {};
      const finalResponse =
        typeof shareData === "string"
          ? shareData
          : shareData.response || "";

      app.globalData.final_response = finalResponse;
    } catch (err) {
      console.error("分享文案生成失败：", err);
    }

    try {
      let videoResp;
      if (this.data.use_extend) {
  videoResp = await wxRequest.post(this.data.extendURL, {
    task_data: fullTaskData
  });
} else {
  videoResp = await wxRequest.post(this.data.videoReq, {
    task_data: fullTaskData
  });
}

      const videoData = videoResp && videoResp.data ? videoResp.data : {};

      if (videoData.task_id) {
        app.globalData.task_data = {
          ...(app.globalData.task_data || {}),
          task_id: videoData.task_id,
          video_id: videoData.task_id
        };
      }
      this.setData({
        videoStatus: videoData.video_status || "processing"
      });
      wx.hideLoading();
      console.log("轮询使用的 task_data:", app.globalData.task_data);
      this.startPolling();
    } catch (err) {
      wx.hideLoading();
      console.error("视频任务启动失败：", err);
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
    }, 10000);

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

      if (next >= 20) {
        next = 20;
      }

      this.setData({
        progress: next
      });

      if (next >= 20) {
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

      const pollingTaskData = { ...taskData };

      const resp = await wxRequest.post(this.data.videoStatusUrl, {
        task_data: pollingTaskData
      });

      const data = resp && resp.data ? resp.data : {};
      const videoStatus = data.video_status || "idle";
      const videoUrl = data.video_url || "";
      const backendProgress =
        typeof data.progress === "number" ? data.progress : null;
      const progress =
        backendProgress == null
          ? this.data.progress
          : Math.min(100, Math.max(20, 20 + backendProgress * 0.8));

      this.setData({
        progress,
        videoStatus
      });

      if (videoStatus === "complete" && videoUrl) {
        this.handleVideoReady(videoUrl, data);
        return;
      }

      if (videoStatus === "failed") {
        this.clearPolling();
        this.clearFakeProgress();

        wx.showToast({
          title: data.video_error || data.error_message || "视频生成失败",
          icon: "none"
        });
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
      videoStatus: "complete"
    });

    app.globalData.video_url = videoUrl;

    if (videoResponse.cover_url) {
      app.globalData.coverUrl = videoResponse.cover_url;
    }

    setTimeout(() => {
      wx.redirectTo({
        url: "../v_output/v_output"
      });
    }, 400);
  }
});