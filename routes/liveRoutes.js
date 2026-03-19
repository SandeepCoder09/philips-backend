const express = require("express");
const router = express.Router();

console.log("✅ liveRoutes loaded");

/* ===== DATA ===== */
const names = [
    "Ramesh", "Suresh", "Mahesh", "Rajesh", "Amit", "Sumit", "Ankit", "Vikas", "Rahul", "Rohit",
    "Mohit", "Karan", "Arjun", "Vivek", "Deepak", "Pankaj", "Nikhil", "Manoj", "Sanjay", "Ajay",
    "Vijay", "Harsh", "Yash", "Aditya", "Shubham", "Abhishek", "Gaurav", "Prakash", "Dinesh",
    "Naresh", "Mukesh", "Ravi", "Suraj", "Vinay", "Akash", "Tarun", "Sachin", "Kapil", "Varun",
    "Siddharth", "Manish", "Ashish", "Chirag", "Lokesh", "Bhavesh", "Hemant", "Jitendra",
    "Kishan", "Lalit", "Neeraj", "Parveen", "Rakesh", "Sandeep", "Sunil", "Umesh", "Yogesh",
    "Imran", "Faizan", "Irfan", "Sameer", "Wasim", "Nadeem", "Shahid", "Aslam", "Shivam"
];

const actions = [
    { type: "Withdraw", amounts: [120, 280, 320, 540, 700, 1050, 1500, 2000, 2580, 3050, 3500, 3890, 5000, 7665, 8433, 9322, 10990, 12500, 15820, 18440, 20500, 35333, 41540, 50000,] },
    { type: "Recharge", amounts: [399, 1499, 4999, 9499, 49999] }
];

function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateTxn() {
    const name = rand(names);
    const action = rand(actions);
    const amount = rand(action.amounts);

    return {
        name,
        type: action.type,
        amount,
        status: "Success"
    };
}

/* ===== ROUTE ===== */
router.get("/", (req, res) => {
    const data = [];

    for (let i = 0; i < 150; i++) {
        data.push(generateTxn());
    }

    res.json({
        success: true,
        data
    });
});

module.exports = router;