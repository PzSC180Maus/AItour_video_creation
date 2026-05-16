const CARD_COLLECTION = "cards";

function getDb() {
  if (!wx.cloud || !wx.cloud.database) {
    return null;
  }
  return wx.cloud.database();
}

function now() {
  return Date.now();
}

function normalizeCard(data) {
  const card = data || {};

  return {
    _id: card._id || "",
    card_id: card.card_id || "",
    target_id: card.target_id || "",
    image_url: card.image_url || "",
    emotion_text: card.emotion_text || "",
    author_openid: card.author_openid || card.openid || "",
    author_name: card.author_name || "用户",
    author_avatar: card.author_avatar || "",
    visibility: card.visibility || "public",
    status: card.status || "published",
    use_count: card.use_count || 0,
    favorite_count: card.favorite_count || 0,
    created_at: card.created_at || now(),
    updated_at: card.updated_at || now()
  };
}

function saveCard(card) {
  const db = getDb();
  const nextCard = normalizeCard(card);

  if (!db || !nextCard.card_id) {
    return Promise.resolve(nextCard);
  }

  return db
    .collection(CARD_COLLECTION)
    .where({ card_id: nextCard.card_id })
    .limit(1)
    .get()
    .then((res) => {
      const existed = res.data && res.data[0];
      const data = {
        card_id: nextCard.card_id,
        target_id: nextCard.target_id,
        image_url: nextCard.image_url,
        emotion_text: nextCard.emotion_text,
        author_openid: nextCard.author_openid,
        author_name: nextCard.author_name,
        author_avatar: nextCard.author_avatar,
        visibility: nextCard.visibility,
        status: nextCard.status,
        use_count: nextCard.use_count,
        favorite_count: nextCard.favorite_count,
        updated_at: now()
      };

      if (existed && existed._id) {
        return db
          .collection(CARD_COLLECTION)
          .doc(existed._id)
          .update({ data })
          .then(() => normalizeCard({ ...existed, ...data }));
      }

      return db
        .collection(CARD_COLLECTION)
        .add({
          data: {
            ...data,
            created_at: now()
          }
        })
        .then(() => normalizeCard(data));
    });
}

function getCardById(cardId) {
  const db = getDb();

  if (!db || !cardId) {
    return Promise.resolve(null);
  }

  return db
    .collection(CARD_COLLECTION)
    .where({ card_id: cardId })
    .limit(1)
    .get()
    .then((res) => {
      const card = res.data && res.data[0];
      return card ? normalizeCard(card) : null;
    });
}

function listCardsByIds(cardIdList) {
  const db = getDb();
  const ids = (Array.isArray(cardIdList) ? cardIdList : [])
    .map((item) => (typeof item === "string" ? item : item && item.id))
    .filter(Boolean);

  if (!db || !ids.length) {
    return Promise.resolve([]);
  }

  const _ = db.command;

  return db
    .collection(CARD_COLLECTION)
    .where({
      card_id: _.in(ids)
    })
    .get()
    .then((res) => {
      const list = Array.isArray(res.data) ? res.data.map(normalizeCard) : [];
      const cardMap = list.reduce((map, card) => {
        map[card.card_id] = card;
        return map;
      }, {});

      return ids.map((id) => cardMap[id]).filter(Boolean);
    });
}

function hydrateCards(list) {
  const safeList = Array.isArray(list) ? list : [];
  const ids = safeList.map((item) => item && item.card_id).filter(Boolean);

  if (!ids.length) {
    return Promise.resolve(safeList);
  }

  return listCardsByIds(ids).then((cloudCards) => {
    const cardMap = cloudCards.reduce((map, card) => {
      map[card.card_id] = card;
      return map;
    }, {});

    return safeList.map((item) => ({
      ...item,
      ...(cardMap[item.card_id] || {})
    }));
  });
}

function recordUse(cardId) {
  const db = getDb();

  if (!db || !cardId) {
    return Promise.resolve();
  }

  const _ = db.command;

  return db
    .collection(CARD_COLLECTION)
    .where({ card_id: cardId })
    .update({
      data: {
        use_count: _.inc(1),
        updated_at: now()
      }
    });
}

module.exports = {
  saveCard,
  getCardById,
  listCardsByIds,
  hydrateCards,
  recordUse,
  normalizeCard
};
