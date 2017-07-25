/**
 * Created by anasp on 2017/6/12.
 */
/**
 * Created by anasp on 2017/6/12.
 */
const cheerio = require('cheerio');
const superagent = require('superagent');
const url = require('url');
const async = require('async');
const mysql=require('mysql');
const hotUrls = 'http://tieba.baidu.com/f?ie=utf-8&kw=oricon&pn=';
let concurrencyCount = 0;
const changthingsub=[];
const indexs = [];
for (let i = 0; i <10; i++) {
    indexs.push(i);
}

const pool = mysql.createPool({
    host: 'awsmysql.ctm3uoan9r5h.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: 'root',
    password: '-ggggw159874',
    database: 'hots',
});

let fetchUrl;
fetchUrl = function (hoturl, callback) {
    concurrencyCount++;
    console.log('现在的并发数是', concurrencyCount);
    superagent.get(hoturl)
        .end(function (err, sres) {
            if (err) {
                return next(err);
            }
            const $ = cheerio.load(sres.text);
            const res = $('#thread_list');
            res.find('.j_th_tit').each(function (idx, element) {
                const $element = $(element);
                if ($element.attr('title') !== undefined) {
                    const  changething=[];
                    const data = res.find('.j_thread_list.clearfix').eq(idx / 2 - 0.5).attr('data-field');
                    const authorName = JSON.parse(data).author_name;
                    const num = JSON.parse(data).reply_num;
                    let time = Math.round(new Date().getTime() / 1000);
                    const title = $element.attr('title').trim();
                    const href = url.resolve(hoturl, $element.attr('href'));
                    pool.getConnection(function (err, connection) {
                        connection.query("SELECT replynum FROM oricon_time WHERE title=?", [title], function (err, result) {
                            if (result !== undefined) {
                                if (result.length !== 0) {
                                    const oldnum = result[result.length - 1];
                                    let diff = num - oldnum.replynum;
                                    if (diff > 0) {
                                        console.log('diff');
                                        changething.push(authorName, diff, href, title, time);
                                        changthingsub.push(changething)
                                    }
                                }
                            }else {
                                changething.push(authorName, num, href, title, time);
                                changthingsub.push(changething);
                            }
                            connection.release();
                        });
                    });
                }
            });
        });
    setTimeout(function () {
        concurrencyCount--;
        callback(null, changthingsub);
    }, 10000);
};

async.mapLimit(indexs, 1, function (index,callback) {
    const hoturl=hotUrls+(index*50).toString();
    fetchUrl(hoturl, callback);
}, function (err, values) {
    const sql="INSERT INTO oricon_diff(author,diff,href,title,time) VALUES ?";
    pool.getConnection(function (err, connection) {
        console.log(err);
        connection.query(sql, [values[0]]);
        connection.release();
        pool.end()
});
});
