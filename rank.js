/**
 * Created by anasp on 2017/6/12.
 */
const cheerio = require('cheerio');
const superagent = require('superagent');
const url = require('url');
const async = require('async');
const mysql=require('mysql');
const config = require('config');

const dbConfig = config.get('Customer.dbConfig');
const UrlConfig = config.get('Customer.UrlConfig');

const hotUrls = UrlConfig;
let concurrencyCount = 0;
const thingsub=[];
const indexs = [];
for (let i = 0; i <10; i++) {
    indexs.push(i);
}

const pool = mysql.createPool(dbConfig);

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
                    const thing=[];
                    const data = res.find('.j_thread_list.clearfix').eq(idx / 2 - 0.5).attr('data-field');
                    const authorName = JSON.parse(data).author_name;
                    const num = JSON.parse(data).reply_num;
                    let time = Math.round(new Date().getTime() / 1000);
                    const title = $element.attr('title').trim();
                    const href = url.resolve(hoturl, $element.attr('href'));
                    thing.push(authorName, num, href, title, time);
                    thingsub.push(thing);
                }
            });
        });
    setTimeout(function () {
        concurrencyCount--;
        callback(null, thingsub);
    }, 5000);
};

async.mapLimit(indexs, 10, function (index,callback) {
    const hoturl=hotUrls+(index*50).toString();
    fetchUrl(hoturl, callback);
}, function (err, values) {
    const sql="INSERT INTO oricon_time(author,replynum,href,title,time) VALUES ?";
    pool.getConnection(function (err, connection) {
        connection.query(sql, [values[0]]);
        connection.release();
        pool.end()
    });
});
