const express = require("express");
const app = express();
const port = 3001;
const ytdl = require('ytdl-core');
const mysql = require('mysql');
const cors = require('cors');

//To use if the 'Content-Type' header is 'application/json'
app.use(express.json())

//To use if the 'Content-Type' header is 'application/x-www-form-urlencoded'
// app.use(express.urlencoded({
//     extended: true
// }));

app.use(cors());

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'ytdl-admin',
    password: 'ytdl-admin-pwd-secret',
    database: 'ytdldownloader'
})

connection.connect((connectionError) => {
    if (connectionError) {
        console.error("Error while connecting to the database --> ", connectionError);
        connection.end();
    } else {
        console.log("Connected to database!");
    }
});


app.use(express.static('../build'));
global.__basedir = __dirname;

app.post('/dummy', (req, res) => {
    console.log(req.body);
    res.send({ hello: "hello World" })
})

app.post("/download", (req, res) => {
    // const url = req.query.url;
    const { url, user } = req.body;
    if (!user || !url) {
        res.end({
            status: 400,
            body: {
                msg: 'Check either the username or the url'
            }
        })
    } else {
        ytdl.getInfo(url).then((info) => {
            console.log('info', info);
            const { videoId, likes } = info.videoDetails;
            const { id: authorId, name, user_url, channel_url, subscriber_count } = info.videoDetails.author;
            connection.query(`
                SELECT videoId
                FROM tVideos
                WHERE videoid = '${videoId}'
            `, (err, res, fields) => {
                console.log('response video query', res);
                if (res.length) {
                    videoid = res[0].videoId;
                } else {
                    connection.query(`
                        INSERT INTO tVideos(videoid,url,likes,authorid,updDate) VALUES ('${videoId}','${url}','${likes}','${authorId}','${getFormattedDate(new Date)}')
                    `)
                }
            });


            connection.query(`
                SELECT authorId
                FROM tAuthors
                WHERE authorId = '${authorId}'
            `, (err, authorResponse, fields) => {
                console.log('author response query ', authorResponse)
                if (res.length) {
                    authorId = authorResponse[0].authorId;
                } else {
                    connection.query(`
                        INSERT INTO tAuthors(authorid, name, user_url, channel_url, subscriber_count, updDate) VALUES ('${authorId}','${name}','${user_url}','${channel_url}',${subscriber_count},'${getFormattedDate(new Date)}')
                    `)
                }
            })

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${info.videoDetails.title}.mp4"`);
            let now = new Date().toISOString().slice(0, 19).replace('T', ' ');

            // 171         webm      audio only  DASH audio  115k , audio@128k (44100Hz), 2.59MiB (worst)
            // 140         m4a       audio only  DASH audio  129k , audio@128k (44100Hz), 3.02MiB
            // 141         m4a       audio only  DASH audio  255k , audio@256k (44100Hz), 5.99MiB
            // 160         mp4       256x144     DASH video  111k , 12fps, video only, 2.56MiB
            // 247         webm      1280x720    DASH video 1807k , 1fps, video only, 23.48MiB
            // 136         mp4       1280x720    DASH video 2236k , 24fps, video only, 27.73MiB
            // 248         webm      1920x1080   DASH video 3993k , 1fps, video only, 42.04MiB
            // 137         mp4       1920x1080   DASH video 4141k , 24fps, video only, 60.28MiB
            // 43          webm      640x360
            // 18          mp4       640x360
            // 22          mp4       1280x720    (best)
            try {
                console.log(info.videoDetails.videoId);
                ytdl(url, { quality: [137], filter: format => format.container === 'mp4' }).pipe(res);
                connection.query(`INSERT INTO tDownloads(videoid, user, updDate) VALUES ('${videoId}','${user}','${now}')`, (err, res, fields) => {
                    console.log(fields);
                    if (err) console.error(err);
                });
            } catch (e) {
                console.log(e);
                res.json({
                    status: 404,
                    body: {
                        msg: 'Video not found!'
                    }
                })
            }
        }).catch((err) => {
            console.log("error", err);
            res.send({
                error: {
                    code: 404,
                    message: `No info found for link ${url}`
                }
            });
        });
    }
});

const getFormattedDate = (date) => {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

app.listen(port, () => console.log(`Server listening on ${port}`));