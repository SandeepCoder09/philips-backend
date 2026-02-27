function formatDateTime() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, "0");

  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());
  const HH = pad(now.getHours());
  const MIN = pad(now.getMinutes());
  const SS = pad(now.getSeconds());

  return `${YYYY}${MM}${DD}${HH}${MIN}${SS}`;
}

function generateTransactionId(type) {

  const prefixMap = {
    recharge: "PHRCTR",        // Recharge
    withdraw: "PHWDTR",        // Withdraw
    purchase: "PHPURTR",       // Product Purchase
    earning: "PHEARN",         // Daily Earning
    commission: "PHCMTR",      // Level Commission
    registration_bonus: "PHREGB", // Registration Bonus
    referral_bonus: "PHREFB",     // Direct Referral Bonus
    team_bonus: "PHTMBTR",        // Team Milestone Bonus
    gift: "PHGFTTR"               // Gift Code
  };

  const prefix = prefixMap[type] || "PHTRX";

  // 2 random digits (10–99)
  const randomTwoDigits = Math.floor(Math.random() * 90 + 10);

  return `${prefix}${formatDateTime()}${randomTwoDigits}`;
}

module.exports = generateTransactionId;