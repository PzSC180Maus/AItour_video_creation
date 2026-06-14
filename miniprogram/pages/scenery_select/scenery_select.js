// pages/scenery_select/scenery_select.js
const app = getApp()

Page({
  data: {
    current: 0,
    selectedSpot: null,
    recommendList: [],
    spotList: [
      {
        id: 1,
        cover: "https://tr-osdcp.qunarzz.com/tr-osd-tr-space/img/bfce80ecbf046c6d76d46759b04e10eb.jpg",
        text: "青海大柴旦，翡翠湖澄澈如镜，人少空旷，适宜定格辽远之美。"
      },
      {
        id: 2,
        cover: "https://ts3.tc.mm.bing.net/th/id/OIP-C.LLcSqgYu2fp1e19RmkgoMgHaFi?cb=thfc1falcon&rs=1&pid=ImgDetMain&o=7&rm=3",
        text: "广西桂林阳朔，峰林叠翠，漓江如练，最宜收录山水相映的清朗意境。"
      },
      {
        id: 3,
        cover: "https://img.pconline.com.cn/images/upload/upc/tx/photoblog/1311/06/c5/28377535_28377535_1383725037413.jpg",
        text: "四川稻城亚丁，雪山草甸相接，湖光澄澈，天然自带静穆空灵之感。"
      },
      {
        id: 4,
        cover: "https://ts1.tc.mm.bing.net/th/id/R-C.1fc590286ddb86170ea75016e3442365?rik=FEcHz6ZFAsyfpA&riu=http%3a%2f%2fimg2.selfimg.com.cn%2fuedvoguecms%2f2017%2f03%2f10%2f1489122657_pMQ2k2.jpg&ehk=P%2fkoOvswMxxw77vRT9Fp2nEETpmmdZAZI9kPQ6PW6Kw%3d&risl=&pid=ImgRaw&r=0",
        text: "油菜花田的金黄铺展，层次分明，适合定格春日生机与乡村田园氛围。"
      },
      {
        id: 5,
        cover: "https://pic.ibaotu.com/22/07/12/paixin/pki_10562306.jpg!fw700",
        text: "新疆喀纳斯，林海湖湾层层铺展，色彩清冽，画面丰富而富有故事感。"
      }
    ]
  },

  selectSpot(e) {
    const index = Number(e.currentTarget.dataset.index);
    const selectedSpot = this.data.spotList[index];

    this.setData({
      current: index,
      selectedSpot
    });

    console.log("selected spot:", selectedSpot);
  },

  onLoad() {
    this.setData({
      selectedSpot: this.data.spotList[0],
      recommendList: this.data.spotList.slice(2)
    });
  },

  confirmSelection() {
    const selectedSpot = this.data.selectedSpot || this.data.spotList[this.data.current];

    if (!selectedSpot) {
      wx.showToast({
        title: "请先选择景点",
        icon: "none"
      });
      return;
    }

    app.globalData.task_data.spot_url = selectedSpot.cover;
    app.globalData.task_data.request = selectedSpot.text;
    app.globalData.task_data.card_id = "";
    app.globalData.task_data.landscape = selectedSpot.landscape || "sharepool";
    app.globalData.task_data.landscape_name = selectedSpot.landscapeName || "公共分享池";
    wx.navigateTo({
      url: "../dialogue/dialogue",
      success: () => {
        console.log("confirmed spot:", selectedSpot);
      },
      fail: (err) => {
        console.error("跳转失败：", err);
        wx.showToast({
          title: "页面跳转失败",
          icon: "none"
        });
      }
    });
  },

  goCommunity() {
    wx.redirectTo({
      url: "/pages/community/community"
    });
  },

  goPublish() {
    wx.navigateTo({
      url: "/pages/card_publish/card_publish"
    });
  },

  goProfile() {
    wx.redirectTo({
      url: "/pages/profile/profile"
    });
  }
});
