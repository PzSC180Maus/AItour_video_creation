const LANDSCAPE_OPTIONS = [
  {
    id: "sharepool",
    name: "公共分享池",
    shortName: "推荐",
    desc: "大家都在看的旅行灵感",
    cover: "https://tr-osdcp.qunarzz.com/tr-osd-tr-space/img/bfce80ecbf046c6d76d46759b04e10eb.jpg"
  },
  {
    id: "001",
    name: "越秀风行",
    shortName: "越秀",
    desc: "城市风景专区正在更新",
    cover: "https://ts3.tc.mm.bing.net/th/id/OIP-C.LLcSqgYu2fp1e19RmkgoMgHaFi?cb=thfc1falcon&rs=1&pid=ImgDetMain&o=7&rm=3"
  },
  {
    id: "002",
    name: "哈工深",
    shortName: "哈工深",
    desc: "校园影像与青春故事",
    cover: "https://img.pconline.com.cn/images/upload/upc/tx/photoblog/1311/06/c5/28377535_28377535_1383725037413.jpg"
  }
];

function normalizeLandscapeId(landscape) {
  return landscape || "sharepool";
}

function getLandscapeName(landscape) {
  const id = normalizeLandscapeId(landscape);
  const option = LANDSCAPE_OPTIONS.find((item) => item.id === id);

  return option ? option.name : "公共分享池";
}

function getLandscapeOption(landscape) {
  const id = normalizeLandscapeId(landscape);
  return (
    LANDSCAPE_OPTIONS.find((item) => item.id === id) || LANDSCAPE_OPTIONS[0]
  );
}

function syncTaskLandscape(taskData, landscape) {
  const option = getLandscapeOption(landscape);

  taskData.landscape = option.id;
  taskData.landscape_name = option.name;

  return option;
}

module.exports = {
  LANDSCAPE_OPTIONS,
  getLandscapeName,
  getLandscapeOption,
  normalizeLandscapeId,
  syncTaskLandscape
};
