// Amazonの注文履歴をTSV形式で出力するスクリプト
//
// 2015-01-01 時点での DOM 構造に対応, GoogleCrome, Opera でテスト済。
// formatEntry関数を書き換えれば自由な書式で出力できます。
//
// 参考:
//  - Amazonの注文履歴をCSV形式にして出力するスクリプト
//    https://gist.github.com/arcatdmz/8500521
//  - Amazon で使った金額の合計を出す奴 (2014 年バージョン)
//    https://gist.github.com/polamjag/866a8af775c44b3c1a6d
(function () {
    // 各注文履歴をTSVフォーマットにして返す
    var datePattern = new RegExp("(\\d{4})年(\\d{1,2})月(\\d{1,2})日");
    function formatEntry(entry) {
        console.log(entry);
        entry.date.match(datePattern);
        var year = RegExp.$1;
        var month = RegExp.$2;
        if (month.length <= 1)
            month = "0" + month;
        var day = RegExp.$3;
        if (day.length <= 1)
            day = "0" + day;
        var date = "" + year + "/" + month + "/" + day;
        var arr = [date, entry.name, entry.price, entry.url];
        return arr.join('\t') + "\n";
    }
    function popup(content) {
        var generator = window.open('', 'name', 'height=250,width=700');
        generator.document.write('<html><head><title>Amazon to TSV</title>');
        generator.document.write('</head><body>');
        generator.document.write('<pre>');
        generator.document.write(content);
        generator.document.write('</pre>');
        generator.document.write('</body></html>');
        generator.document.close();
        return generator;
    }
    var itemDelimiter = " / ";
    var total = {};
    var year = 2016;
    var all = false;
    function init(num) {
        if (typeof num !== 'number') {
            var num = 0;
            $('<div/>').css({
                position: 'fixed',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                zIndex: 1000,
                backgroundColor: 'rgba(0,0,0,.7)',
                color: '#fff',
                fontSize: 30,
                textAlign: 'center',
                paddingTop: '15em'
            }).attr('id', '___overlay').text('Amazonいくら使った？').appendTo('body');
            var inp = window.prompt('何年分の注文を集計しますか？\n - 半角数字4桁で入力してください\n - 全期間を集計する場合は「all」と入力します', year.toString());
            if (inp === 'all') {
                all = true;
                year = jQuery('div.top-controls select option:last').val().match(/[0-9]/g).join('');
            }
            else if (!/^[0-9]{4}$/.test(inp)) {
                alert('正しい数値を入力してください');
                $('#___overlay').remove();
                return false;
            }
            else {
                year = Number(inp);
            }
        }
        // 第二引数を true にすると各商品とかエラーを逐一表示する
        var progress = load(num, false);
        $('#___overlay').text(year.toString() + '年の集計中…  / ' + (num + 1) + 'ページ目');
        progress.done(function (results) {
            if (typeof total[year] === 'undefined') {
                total[year] = results;
            }
            else {
                total[year] = total[year].concat(results);
            }
            init(num + 1);
        }).fail(function () {
            if (all && new Date().getFullYear() > year) {
                year++;
                init(0);
            }
            else {
                var _total = 0;
                var _content = "";
                jQuery.each(total, function (year, results) {
                    var yen = 0;
                    jQuery.each(results, function () {
                        yen += this.price;
                        $.each(this.items, function (i, item) {
                            _content += formatEntry(item);
                        });
                    });
                    _total += yen;
                });
                // result
                $('#___overlay').remove();
                alert('合計 ' + _total + ' 円');
                popup(_content);
                console.log('合計 ' + _total + ' 円');
            }
        });
    }
    function parsePage(data, results, lnks, verbose) {
        var dom = jQuery.parseHTML(data);
        jQuery(dom).find('div.order').each(function () {
            var box = jQuery(this);
            var emphasis = jQuery(box.find("a.a-link-emphasis"));
            if (emphasis.length > 0) {
                var path = emphasis.attr('href').trim().replace('/ref=/', '');
                var lnk = 'https://www.amazon.co.jp' + path;
                lnks.push(lnk);
            }
            else {
                var dateText = jQuery(box.find('div.order-info span.value')[0]).text().trim();
                var items = [];
                var item = {};
                var pubarr = box.find("div.a-row > span.a-size-small");
                box.find("div.a-row > a.a-link-normal").each(function (j) {
                    item = {};
                    item['name'] = $(this).text().trim();
                    item['path'] = $(this).attr('href').trim().replace(/ref=.*/, '');
                    item['url'] = 'https://www.amazon.co.jp' + item['path'];
                    item['date'] = dateText;
                    item['author'] = $(pubarr[j * 2]).text().trim().replace(/(\n)/g, '').replace(/ +/g, ' ');
                    item['price'] = $(this).parent().parent().find("span.a-color-price").text().trim();
                    items.push(item);
                });
                var priceText = jQuery(box.find('div.order-info span.value')[1]).text();
                var price = 0;
                if (priceText.match(/[0-9]/g) != null) {
                    price = Number(priceText.match(/[0-9]/g).join(''));
                }
                if (verbose)
                    console.log(item, price);
                results.push({ 'date': dateText, 'items': items, 'price': price });
            }
        });
    }
    function parsePage2(data, results, verbose) {
        var dom = jQuery.parseHTML(data);
        var dateText = jQuery(dom).find('span.order-date-invoice-item').first().text().trim();
        var items = [];
        var item = {};
        jQuery(dom).find('div.shipment-is-delivered').each(function () {
            var box = jQuery(this);
            var pubarr = box.find("div.a-spacing-base");
            box.find("div.a-row > a.a-link-normal").each(function (j) {
                item = {};
                item['name'] = $(this).text().trim();
                //item['path'] = $(this).attr('href').trim();
                item['path'] = $(this).attr('href').trim().replace(/ref=.*/, '');
                item['url'] = 'https://www.amazon.co.jp' + item['path'];
                item['date'] = dateText;
                item['author'] = $(pubarr[j * 2]).text().trim().replace(/(\n)/g, '').replace(/ +/g, ' ');
                item['price'] = $(this).parent().parent().find("span.a-color-price").text().trim();
                items.push(item);
            });
        });
        var priceText = jQuery(dom).find('div.a-first div.a-fixed-right-grid-inner div.a-span-last span.a-text-bold').text();
        var price = 0;
        if (priceText.match(/[0-9]/g) != null) {
            price = Number(priceText.match(/[0-9]/g).join(''));
        }
        if (verbose)
            console.log(item, price);
        results.push({ 'date': dateText, 'items': items, 'price': price });
    }
    function load(num, verbose) {
        var df = jQuery.Deferred();
        var results = [];
        var lnks = [];
        var page = get(num, verbose);
        page.done(function (data) {
            parsePage(data, results, lnks, verbose);
            var dfunc = function (url) {
                var df2 = jQuery.Deferred();
                get_url(url, verbose)
                    .done(function (data) {
                    parsePage2(data, results, verbose);
                    df2.resolve();
                });
                return df2.promise();
            };
            if (lnks.length > 0) {
                var dlist = [];
                for (var _i = 0; _i < lnks.length; _i++) {
                    var url = lnks[_i];
                    dlist.push(dfunc(url));
                }
                $('#___overlay').text(year.toString() + '年の集計中…  / ' + (num + 1) + 'ページ目（サブ' + lnks.length + '）');
                var dwhen = jQuery.when.apply(null, dlist);
                dwhen.done(function () {
                    if (results.length <= 0) {
                        df.reject();
                    }
                    else {
                        df.resolve(results);
                    }
                })
                    .fail(function () {
                    $('#___overlay').text(year.toString() + '年の集計中…  / ' + (num + 1) + 'ページ目（サブ 失敗）');
                    setTimeout(function () {
                        if (verbose)
                            console.log("fail");
                    }, 500);
                });
            }
            else {
                if (results.length <= 0) {
                    df.reject();
                }
                else {
                    df.resolve(results);
                }
            }
        });
        return df.promise();
    }
    function get(num, verbose) {
        var url = 'https://www.amazon.co.jp/gp/css/order-history?digitalOrders=1&unifiedOrders=1&orderFilter=year-' + year.toString() + '&startIndex=' + num * 10;
        return get_url(url, verbose);
    }
    function get_url(strUrl, verbose) {
        var df = jQuery.Deferred();
        jQuery.ajax({
            url: strUrl,
            beforeSend: function (xhr) {
                function toString() { return ''; }
                xhr.setRequestHeader('X-Requested-With', 'toString');
            },
            success: function (data) {
                df.resolve(data);
            }
        })
            .fail(function (jqXHR, msg) {
            if (verbose)
                console.log("fail", msg);
        });
        return df.promise();
    }
    if (typeof jQuery !== 'function') {
        var d = document;
        var s = d.createElement('script');
        s.src = '//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js';
        s.onload = function (e) { init(null); };
        d.body.appendChild(s);
    }
    else {
        init(null);
    }
})();
//# sourceMappingURL=amazon_record.js.map