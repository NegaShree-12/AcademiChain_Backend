PS D:\visual studio\AcademiChain_Backend> mongosh "mongodb+srv://negashree2203_db_user:XRQR5QlM7dVF7eNp@cluster0.pjv25s2.mongodb.net/academichain"
Current Mongosh Log ID: 699d78549486f124d063b111
Connecting to: mongodb+srv://<credentials>@cluster0.pjv25s2.mongodb.net/academichain?appName=mongosh+2.5.9
Using MongoDB: 8.0.19
Using Mongosh: 2.5.9
mongosh 2.7.0 is available for download: https://www.mongodb.com/try/download/shell

For mongosh info see: https://www.mongodb.com/docs/mongodb-shell/

Atlas atlas-pc3w44-shard-0 [primary] academichain> use academichain  
already on db academichain
Atlas atlas-pc3w44-shard-0 [primary] academichain> db.users.find({ walletAddress: "0xcf004c24ce231eded0e65e95d7479da14be6623b" })
...
[
{
_id: ObjectId('698d94fdb4b363198e7453c1'),
walletAddress: '0xcf004c24ce231eded0e65e95d7479da14be6623b',
name: 'User cf004c',
email: 'cf004c@academichain.user',
role: 'student',
institution: null,
isVerified: true,
lastLogin: ISODate('2026-02-24T10:04:51.689Z'),
createdAt: ISODate('2026-02-12T08:53:17.570Z'),
updatedAt: ISODate('2026-02-24T10:04:51.697Z'),
__v: 0,
isActive: true,
isEmailVerified: false,
settings: { darkMode: false, language: 'en', notifications: true },
studentId: 'STU2024001'
}
]
Atlas atlas-pc3w44-shard-0 [primary] academichain> db.users.deleteOne({ walletAddress: "0xcf004c24ce231eded0e65e95d7479da14be6623b" })
...
{ acknowledged: true, deletedCount: 1 }
Atlas atlas-pc3w44-shard-0 [primary] academichain> db.users.find({ walletAddress: "0xcf004c24ce231eded0e65e95d7479da14be6623b" })
...

Atlas atlas-pc3w44-shard-0 [primary] academichain> exit
PS D:\visual studio\AcademiChain_Backend>
