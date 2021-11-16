const express = require("express");
const app = express();
const port = 3001;
const ytdl = require('ytdl-core');
app.use(express.static('../build'));
/* app.use('*', (req,res,next) => {
    console.log(req.body);
    next();
}) */

global.__basedir = __dirname;
// app.use('*',(req,res,next) => {
//     console.log(req.body);
//     next();
// })
app.get("/", (req, res) => {
    res.send("We are on home");
});

app.get("/posts", (req, res) => {
    res.send("We are on posts");
});

app.get("/download", (req, res) => {
    const url = req.query.url;

    ytdl.getInfo(url).then((info) => {
        res.setHeader('Content-Type', `video/mp4`);
        res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);
        ytdl(url).pipe(res);
    }).catch((err) => {
        console.log("error", err);
        res.send({
            error: {
                code: 404,
                message: `No info found for link ${url}`
            }
        });
    });
});



app.listen(port, () => console.log(`Server listening on ${port}`));

