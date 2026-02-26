function formatDateTime() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
  
    return (
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }
  
  function generateTransactionId(type) {
    const map = {
      recharge: "PHRCTR",
      withdraw: "PHWDTR",
      purchase: "PHPURTR",
      earning: "PHEARN",
      registration_bonus: "PHREGB",
      referral_bonus: "PHREFB",
      commission: "PHCMTR",
      team_bonus: "PHTMBTR",
      gift: "PHGIFTTR"
    };
  
    const prefix = map[type] || "PHTRX";
  
    // 🔐 Add 2 random digits (00–99)
    const randomTwoDigits = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
  
    return `${prefix}${formatDateTime()}${randomTwoDigits}`;
  }
  
  module.exports = generateTransactionId;