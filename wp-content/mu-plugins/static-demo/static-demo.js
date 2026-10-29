/**
 * 静态演示站的前端逻辑（只在 scripts/export-static.sh 导出的页面中加载）。
 *
 * 1. 浏览器端购物车：商品存在访客自己浏览器的 localStorage 里。
 *    加入购物车、改数量、删除、页头数量/金额、悬停预览、购物车页、结账页的订单明细都会联动。
 *    页面里的购物车 HTML 是导出时用一件示例商品生成的，这里把它当“模板”复制，样式与原网站完全一致。
 * 2. 需要服务器的表单（登录、注册、下单、搜索、优惠码等）提交时弹出“演示版不可用”的提示。
 */
(function () {
	'use strict';

	var CFG = window.yunlianStaticDemo || {};
	var S = CFG.strings || {};
	var SHOP = CFG.shop || null;

	// ---------------------------------------------------------------- 提示框
	var toastEl, toastTimer;
	function toast(msg) {
		if (!toastEl) {
			toastEl = document.createElement('div');
			toastEl.id = 'static-demo-toast';
			toastEl.setAttribute('role', 'status');
			toastEl.style.cssText = 'position:fixed;left:50%;bottom:100px;transform:translateX(-50%);z-index:999999;' +
				'background:#222;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;' +
				'box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:90vw;text-align:center;display:none';
			document.body.appendChild(toastEl);
		}
		toastEl.textContent = msg;
		toastEl.style.display = 'block';
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { toastEl.style.display = 'none'; }, 3000);
	}

	// ---------------------------------------------------------------- 购物车数据
	// 以购物车页网址区分不同站点（同一个 github.io 域名下可能有多个演示站）
	var KEY = 'yunlian-static-cart:' + (CFG.storeKey !== undefined ? CFG.storeKey : (SHOP ? SHOP.cartUrl : ''));  // 中英文页面共用
	var memory = [];
	function loadCart() {
		try {
			var v = JSON.parse(localStorage.getItem(KEY) || '[]');
			if (!Array.isArray(v)) return [];
			// 中英文共用购物车：商品名和链接按当前页面的语言显示
			var names = CFG.productNames || {};
			v.forEach(function (it) {
				var n = names[it.id];
				if (n) { it.name = n[0]; it.url = n[1]; }
			});
			return v;
		} catch (e) { return memory; }
	}
	function saveCart(cart) {
		memory = cart;
		try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* 隐私模式等情况：只保存在当前页面 */ }
	}
	function findItem(cart, id) {
		for (var i = 0; i < cart.length; i++) { if (String(cart[i].id) === String(id)) return cart[i]; }
		return null;
	}
	function totals(cart) {
		var sub = 0, tax = 0, count = 0, r = (SHOP && SHOP.taxEnabled ? SHOP.taxRate : 0) / 100;
		cart.forEach(function (it) {
			var line = it.price * it.qty;
			sub += line;
			count += it.qty;
			if (it.taxable && r) {
				tax += SHOP.pricesIncludeTax ? round2(line - line / (1 + r)) : round2(line * r);
			}
		});
		return { subtotal: sub, tax: tax, total: SHOP && SHOP.pricesIncludeTax ? sub : sub + tax, count: count };
	}
	function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

	// ---------------------------------------------------------------- 价格格式（与 WooCommerce 输出的 HTML 相同）
	function esc(s) {
		return String(s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}
	function money(n) {
		var c = SHOP.currency, parts = Math.abs(n).toFixed(c.decimals).split('.');
		parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, c.tsep);
		var num = (n < 0 ? '-' : '') + parts.join(c.dsep);
		var sym = '<span class="woocommerce-Price-currencySymbol">' + esc(c.symbol) + '</span>';
		var body = { left: sym + num, right: num + sym, left_space: sym + '&nbsp;' + num, right_space: num + '&nbsp;' + sym }[c.pos] || sym + num;
		return '<span class="woocommerce-Price-amount amount"><bdi>' + body + '</bdi></span>';
	}
	function setMoney(el, n) {
		if (!el) return;
		var amount = el.matches('.woocommerce-Price-amount') ? el : el.querySelector('.woocommerce-Price-amount');
		if (amount) amount.outerHTML = money(n); else el.innerHTML = money(n);
	}
	function fmt(tpl, name) { return (tpl || '%s').replace('%s', '“' + name + '”'); }

	// ---------------------------------------------------------------- 模板（导出时生成的示例商品 HTML）
	var T = {};
	function captureTemplates() {
		var mini = document.querySelector('.ct-header-cart .ct-cart-content');
		if (mini && mini.querySelector('.woocommerce-mini-cart-item')) T.mini = mini.cloneNode(true);
		var row = document.querySelector('.woocommerce-cart-form .woocommerce-cart-form__cart-item');
		if (row) T.cartRow = row.cloneNode(true);
		var co = document.querySelector('.woocommerce-checkout-review-order-table tbody .cart_item');
		if (co) T.checkoutRow = co.cloneNode(true);
	}

	// 把一行模板填成指定商品
	var uid = 0;
	function fillItem(node, it) {
		node.querySelectorAll('a[href]').forEach(function (a) {
			if (a.matches('.remove, .remove_from_cart_button')) {
				a.setAttribute('href', '#');
				a.setAttribute('data-yl-remove', it.id);
				a.setAttribute('aria-label', (S.removeLabel || '%s').replace('%s', it.name));
				a.removeAttribute('data-cart_item_key');
				a.setAttribute('data-product_id', it.id);
			} else {
				a.setAttribute('href', it.url);
			}
		});
		node.querySelectorAll('img').forEach(function (img) {
			img.src = it.img; img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.alt = it.name;
		});
		var title = node.querySelector('.product-title, td.product-name > a');
		if (title) title.textContent = it.name;
		node.querySelectorAll('input.qty').forEach(function (input) {
			uid += 1;
			input.value = it.qty;
			input.name = 'cart[' + it.id + '][qty]';
			input.id = 'yl-qty-' + uid;
			input.setAttribute('data-yl-qty', it.id);
			var label = input.parentNode.querySelector('label');
			if (label) { label.setAttribute('for', input.id); label.textContent = it.name; }
		});
	}

	// ---------------------------------------------------------------- 渲染
	function render() {
		if (!SHOP) return;
		var cart = loadCart(), t = totals(cart);

		// 页头：数量、金额
		document.querySelectorAll('.ct-dynamic-count-cart').forEach(function (el) {
			el.textContent = t.count; el.setAttribute('data-count', t.count);
		});
		document.querySelectorAll('.ct-header-cart .ct-label .ct-amount').forEach(function (el) {
			el.innerHTML = money(t.subtotal);
		});

		renderMini(cart, t);

		// 购物车页
		var form = document.querySelector('form.woocommerce-cart-form');
		if (form && T.cartRow) {
			// Blocksy 把表单和“购物车总计”放在同一个网格容器里；标准 WooCommerce 主题则是 .cart-collaterals
			var grid = form.closest('.ct-woocommerce-cart-form') || form;
			var collaterals = document.querySelector('.cart-collaterals');
			var empty = document.querySelector('.yl-cart-empty');
			if (!cart.length) {
				grid.style.display = 'none';
				if (collaterals) collaterals.style.display = 'none';
				if (!empty) {
					empty = document.createElement('div');
					empty.className = 'yl-cart-empty';
					empty.innerHTML = '<div class="wc-empty-cart-message"><div class="cart-empty woocommerce-info" role="status">' +
						esc(S.cartEmpty || '') + '</div></div><p class="return-to-shop"><a class="button wc-backward" href="' +
						esc(SHOP.shopUrl) + '">' + esc(S.returnToShop || '') + '</a></p>';
					grid.parentNode.insertBefore(empty, grid);
				}
			} else {
				grid.style.display = '';
				if (collaterals) collaterals.style.display = '';
				if (empty) empty.remove();
				var tbody = form.querySelector('tbody');
				tbody.querySelectorAll('.woocommerce-cart-form__cart-item').forEach(function (r) { r.remove(); });
				var actions = tbody.querySelector('td.actions');
				var before = actions ? actions.parentNode : null;
				cart.forEach(function (it) {
					var row = T.cartRow.cloneNode(true);
					fillItem(row, it);
					row.querySelectorAll('td.product-name .woocommerce-Price-amount').forEach(function (el) { setMoney(el, it.price); });
					setMoney(row.querySelector('td.product-subtotal'), it.price * it.qty);
					tbody.insertBefore(row, before);
				});
				// 数量改动即时计算，不需要“更新购物车”按钮
				var upd = form.querySelector('button[name="update_cart"]');
				if (upd) upd.style.display = 'none';
			}
			setTotals(document.querySelector('.cart_totals'), t);
		}

		// 结账页
		var review = document.querySelector('.woocommerce-checkout-review-order-table');
		if (review && T.checkoutRow) {
			if (!cart.length) { location.replace(SHOP.cartUrl); return; }
			var body = review.querySelector('tbody');
			body.innerHTML = '';
			cart.forEach(function (it) {
				var row = T.checkoutRow.cloneNode(true);
				var name = row.querySelector('td.product-name');
				if (name) name.innerHTML = esc(it.name) + '&nbsp; <strong class="product-quantity">&times;&nbsp;' + it.qty + '</strong>';
				setMoney(row.querySelector('td.product-total'), it.price * it.qty);
				body.appendChild(row);
			});
			setTotals(review, t);
		}
	}

	function renderMini(cart, t) {
		document.querySelectorAll('.ct-header-cart .ct-cart-content').forEach(function (box) {
			box.setAttribute('data-count', t.count);
			if (!cart.length || !T.mini) {
				box.innerHTML = '<p class="woocommerce-mini-cart__empty-message">' + esc(S.miniEmpty || '') + '</p>';
				return;
			}
			var tpl = T.mini.cloneNode(true), ul = tpl.querySelector('.woocommerce-mini-cart');
			var liTpl = ul.querySelector('.woocommerce-mini-cart-item');
			ul.innerHTML = '';
			cart.forEach(function (it) {
				var li = liTpl.cloneNode(true);
				fillItem(li, it);
				var q = li.querySelector('.quantity');
				if (q) q.innerHTML = it.qty + ' &times; ' + money(it.price);
				ul.appendChild(li);
			});
			setMoney(tpl.querySelector('.woocommerce-mini-cart__total'), t.subtotal);
			box.innerHTML = tpl.innerHTML;
		});
	}

	function setTotals(scope, t) {
		if (!scope) return;
		setMoney(scope.querySelector('.cart-subtotal td'), t.subtotal);
		setMoney(scope.querySelector('.tax-total td'), t.tax);
		setMoney(scope.querySelector('.order-total td'), t.total);
	}

	// ---------------------------------------------------------------- 页面顶部的 WooCommerce 提示条
	function wcNotice(html, type) {
		var wrap = document.querySelector('.woocommerce-notices-wrapper');
		if (!wrap) { toast(html.replace(/<[^>]+>/g, '')); return; }
		wrap.innerHTML = '<div class="woocommerce-' + (type || 'message') + '" role="alert">' + html + '</div>';
		wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// ---------------------------------------------------------------- 购物车操作
	function addToCart(product, qty, quiet) {
		var cart = loadCart(), it = findItem(cart, product.id);
		if (it) {
			it.qty += qty;
		} else {
			it = { id: product.id, name: product.name, price: product.price, url: product.url, img: product.img, taxable: product.taxable, max: product.max, qty: qty };
			cart.push(it);
		}
		if (product.max > 0 && it.qty > product.max) it.qty = product.max;
		saveCart(cart);
		render();
		if (quiet) { toast(fmt(S.added, product.name)); return; }
		wcNotice('<a href="' + esc(SHOP.cartUrl) + '" tabindex="1" class="button wc-forward">' + esc(S.viewCart || '') + '</a> ' +
			esc(fmt(S.added, product.name)));
	}
	function removeFromCart(id) {
		var cart = loadCart(), it = findItem(cart, id);
		if (!it) return;
		saveCart(cart.filter(function (x) { return x !== it; }));
		render();
		if (document.querySelector('form.woocommerce-cart-form')) wcNotice(esc(fmt(S.removed, it.name)));
		else toast(fmt(S.removed, it.name));
	}
	// 修改数量。购物车页上只就地更新数字（不重新生成整行），这样 + / − 按钮一直有效，打字时输入框也不会丢焦点。
	function setQty(id, qty) {
		var cart = loadCart(), it = findItem(cart, id);
		if (!it) return;
		if (!(qty > 0)) { removeFromCart(id); return; }
		if (it.max > 0 && qty > it.max) qty = it.max;
		it.qty = qty;
		saveCart(cart);
		var row = document.querySelector('.woocommerce-cart-form input.qty[data-yl-qty="' + id + '"]');
		if (!row) { render(); return; }
		row = row.closest('.woocommerce-cart-form__cart-item');
		row.querySelectorAll('input.qty').forEach(function (input) {
			if (input !== document.activeElement || parseInt(input.value, 10) !== qty) input.value = qty;
		});
		setMoney(row.querySelector('td.product-subtotal'), it.price * qty);
		renderHeaderAndTotals(cart);
	}
	function renderHeaderAndTotals(cart) {
		var t = totals(cart);
		document.querySelectorAll('.ct-dynamic-count-cart').forEach(function (el) {
			el.textContent = t.count; el.setAttribute('data-count', t.count);
		});
		document.querySelectorAll('.ct-header-cart .ct-label .ct-amount').forEach(function (el) { el.innerHTML = money(t.subtotal); });
		renderMini(cart, t);
		setTotals(document.querySelector('.cart_totals'), t);
	}

	// ---------------------------------------------------------------- 事件
	document.addEventListener('click', function (e) {
		var a = e.target.closest && e.target.closest('a.remove, a.remove_from_cart_button, a[href*="remove_item="]');
		if (!a) return;
		e.preventDefault(); e.stopImmediatePropagation();
		var id = a.getAttribute('data-yl-remove') || a.getAttribute('data-product_id');
		if (SHOP && id) removeFromCart(id); else toast(S.unavailable);
	}, true);

	// 首页商品区块里的“加入购物车”按钮（WooCommerce 区块按钮，原本要请求服务器）：
	// 从商品卡片读出名称、价格、图片、链接，加入浏览器端购物车。
	function priceFromCard(card) {
		var el = card.querySelector('.wc-block-components-product-price ins .amount, .wc-block-components-product-price .amount, .price ins .amount, .price .amount');
		if (!el || !SHOP) return NaN;
		var c = SHOP.currency, txt = el.textContent.split(c.tsep).join('');
		return parseFloat(txt.replace(c.dsep, '.').replace(/[^0-9.]/g, ''));
	}
	document.addEventListener('click', function (e) {
		var btn = e.target.closest && e.target.closest('.wc-block-components-product-button__button, a.add_to_cart_button, button.add_to_cart_button');
		if (!btn || !SHOP || btn.closest('form.cart')) return;
		var card = btn.closest('li.wc-block-product, li.product');
		if (!card) return;
		e.preventDefault(); e.stopImmediatePropagation();
		var title = card.querySelector('.wp-block-post-title a, .woocommerce-loop-product__title a, .wp-block-post-title, .woocommerce-loop-product__title');
		var link = (title && title.closest('a')) || (title && title.querySelector('a')) || card.querySelector('a[href]');
		var img = card.querySelector('img');
		var ctx = {}; try { ctx = JSON.parse(card.getAttribute('data-wp-context') || '{}'); } catch (err) { /* 忽略 */ }
		var id = ctx.productId || btn.getAttribute('data-product_id') || (card.className.match(/post-(\d+)/) || [])[1];
		var price = priceFromCard(card);
		if (!id || isNaN(price)) { toast(S.unavailable); return; }
		addToCart({
			id: parseInt(id, 10),
			name: ((title && title.textContent) || (img && img.alt) || '').trim(),
			price: price,
			url: link ? link.href : SHOP.shopUrl,
			img: img ? (img.currentSrc || img.src) : '',
			taxable: /\btaxable\b/.test(card.className),
			max: -1
		}, 1, true);
		var label = btn.querySelector('span') || btn, old = label.textContent;
		label.textContent = '✓ ' + (S.addedShort || '已加入');
		setTimeout(function () { label.textContent = old; }, 1500);
	}, true);

	// 购物车页数量
	function storedQty(id) { var it = findItem(loadCart(), id); return it ? it.qty : 1; }
	// + / −：自己处理（捕获阶段拦截，主题脚本就不会重复加减）。“−”最少减到 1，删除请用垃圾桶按钮。
	document.addEventListener('click', function (e) {
		var btn = e.target.closest && e.target.closest('.woocommerce-cart-form .ct-increase, .woocommerce-cart-form .ct-decrease');
		if (!btn) return;
		var input = btn.parentNode.querySelector('input.qty[data-yl-qty]');
		if (!input) return;
		e.preventDefault(); e.stopImmediatePropagation();
		var id = input.getAttribute('data-yl-qty');
		var qty = storedQty(id) + (btn.classList.contains('ct-increase') ? 1 : -1);
		setQty(id, Math.max(1, qty));
	}, true);
	// 打字：输入有效数字就立即计算
	document.addEventListener('input', function (e) {
		var input = e.target;
		if (!(input.matches && input.matches('.woocommerce-cart-form input.qty[data-yl-qty]'))) return;
		var v = parseInt(input.value, 10);
		if (v > 0) setQty(input.getAttribute('data-yl-qty'), v);
	}, true);
	// 离开输入框：空着或填 0 的，恢复为当前数量
	document.addEventListener('change', function (e) {
		var input = e.target;
		if (!(input.matches && input.matches('.woocommerce-cart-form input.qty[data-yl-qty]'))) return;
		var v = parseInt(input.value, 10);
		if (!(v > 0)) input.value = storedQty(input.getAttribute('data-yl-qty'));
	}, true);

	document.addEventListener('submit', function (e) {
		var f = e.target;
		e.preventDefault(); e.stopImmediatePropagation();
		// 商品页“加入购物车”
		if (SHOP && SHOP.product && f.matches('form.cart')) {
			var q = f.querySelector('input.qty');
			addToCart(SHOP.product, Math.max(1, parseInt(q ? q.value : '1', 10) || 1));
			return;
		}
		// 购物车页：“应用优惠”不可用；在数量框里按回车时数量已经即时更新，什么都不用做
		if (f.matches('form.woocommerce-cart-form')) {
			var sub = e.submitter;
			if (sub && sub.name === 'apply_coupon') toast(S.coupon);
			else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
			return;
		}
		toast(S.unavailable);
	}, true);

	// ---------------------------------------------------------------- 接口请求
	// WooCommerce 区块脚本会请求 wp-json / wc-ajax 接口，静态站上没有，统一返回“不可用”的 JSON，避免控制台报错。
	if (window.fetch) {
		var realFetch = window.fetch.bind(window);
		window.fetch = function (input, init) {
			var url = typeof input === 'string' ? input : (input && input.url) || '';
			if (/\/wp-json\/|[?&]wc-ajax=|admin-ajax\.php/.test(url)) {
				return Promise.resolve(new Response(JSON.stringify({ code: 'static_demo', message: S.unavailable }), {
					status: 503, headers: { 'Content-Type': 'application/json' }
				}));
			}
			return realFetch(input, init);
		};
	}


	// ---------------------------------------------------------------- 商品轮播（首页按分类展示的商品区块）
	// 导出时每个区块输出了该分类的全部商品，并标记了原来的每页数量（data-yl-per-page）。
	// 这里按每页数量分组，点左右箭头（或在手机上左右滑动）时整组平滑滑动切换。
	// 每一组都是原来商品列表的复制，所以排版、样式与原网站完全一致。
	function initCarousels() {
		var blocks = document.querySelectorAll('[data-yl-per-page]');
		if (!blocks.length) return;
		var css = document.createElement('style');
		css.textContent =
			'.yl-carousel{overflow:hidden;position:relative;transition:height .5s cubic-bezier(.22,.61,.36,1)}' +
			'.yl-carousel-track{display:flex;align-items:flex-start;transition:transform .6s cubic-bezier(.22,.61,.36,1);will-change:transform}' +
			'.yl-carousel-track.yl-dragging{transition:none}' +
			'.yl-carousel-page{flex:0 0 100%;max-width:100%;min-width:0;box-sizing:border-box;margin-top:0!important;margin-bottom:0!important}' +
			'.yl-carousel-nav a{cursor:pointer;transition:opacity .3s}' +
			'.yl-carousel-nav a.yl-off{opacity:0;pointer-events:none}' +
			'@media (prefers-reduced-motion:reduce){.yl-carousel,.yl-carousel-track{transition:none}}';
		document.head.appendChild(css);

		blocks.forEach(function (block) {
			var per = parseInt(block.getAttribute('data-yl-per-page'), 10);
			var ul = block.querySelector('ul.wc-block-product-template');
			var nav = block.querySelector('.wp-block-query-pagination');
			if (!ul || !(per > 0)) return;
			var items = [].slice.call(ul.children);
			var count = Math.ceil(items.length / per);
			if (count <= 1) { if (nav) nav.style.display = 'none'; return; }

			// 视窗 + 轨道 + 每组一个列表
			var viewport = document.createElement('div');
			viewport.className = 'yl-carousel';
			var track = document.createElement('div');
			track.className = 'yl-carousel-track';
			ul.parentNode.insertBefore(viewport, ul);
			viewport.appendChild(track);
			var pages = [];
			for (var i = 0; i < count; i++) {
				var page = i === 0 ? ul : ul.cloneNode(false);
				if (i > 0) page.removeAttribute('id');
				page.classList.add('yl-carousel-page');
				items.slice(i * per, (i + 1) * per).forEach(function (li) { page.appendChild(li); });
				page.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
				track.appendChild(page);
				pages.push(page);
			}

			// 箭头：沿用原网站的“下一页”链接，再按同样的结构复制出“上一页”
			var next = nav && nav.querySelector('.wp-block-query-pagination-next');
			var prev = nav && nav.querySelector('.wp-block-query-pagination-previous');
			if (!next) return;
			if (!prev) {
				prev = next.cloneNode(true);
				prev.className = next.className.replace('next', 'previous');
				var arrow = prev.querySelector('span');
				if (arrow) {
					arrow.className = arrow.className.replace('next', 'previous');
					arrow.textContent = { '»': '«', '→': '←', '›': '‹' }[arrow.textContent.trim()] || '«';
				}
				nav.insertBefore(prev, next);
			}
			[prev, next].forEach(function (a) {
				[].slice.call(a.attributes).forEach(function (attr) {
					if (attr.name.indexOf('data-wp-') === 0) a.removeAttribute(attr.name); // 不让 WooCommerce 去请求服务器翻页
				});
				a.setAttribute('href', '#');
				a.setAttribute('role', 'button');
			});
			prev.setAttribute('aria-label', S.prevGroup || '上一组');
			next.setAttribute('aria-label', S.nextGroup || '下一组');
			nav.classList.add('yl-carousel-nav');

			var current = 0;
			function go(index) {
				current = Math.max(0, Math.min(count - 1, index));
				track.style.transform = 'translateX(' + (-100 * current) + '%)';
				viewport.style.height = pages[current].offsetHeight + 'px';
				pages.forEach(function (pg, n) {
					pg.setAttribute('aria-hidden', n === current ? 'false' : 'true');
					// 相邻的组提前加载图片，滑动时不会出现空白
					if (Math.abs(n - current) <= 1) pg.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
				});
				prev.classList.toggle('yl-off', current === 0);
				next.classList.toggle('yl-off', current === count - 1);
			}
			function click(delta) {
				return function (e) { e.preventDefault(); e.stopImmediatePropagation(); go(current + delta); };
			}
			prev.addEventListener('click', click(-1), true);
			next.addEventListener('click', click(1), true);

			// 手机上左右滑动
			var startX = null, startY = 0, dx = 0;
			viewport.addEventListener('touchstart', function (e) {
				startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0;
			}, { passive: true });
			viewport.addEventListener('touchmove', function (e) {
				if (startX === null) return;
				dx = e.touches[0].clientX - startX;
				if (Math.abs(dx) > Math.abs(e.touches[0].clientY - startY)) {
					track.classList.add('yl-dragging');
					track.style.transform = 'translateX(calc(' + (-100 * current) + '% + ' + dx + 'px))';
				}
			}, { passive: true });
			viewport.addEventListener('touchend', function () {
				if (startX === null) return;
				track.classList.remove('yl-dragging');
				go(current + (dx < -50 ? 1 : dx > 50 ? -1 : 0));
				startX = null;
			});

			go(0);
			// 图片加载完成、窗口大小变化后，高度跟着当前这一组调整
			window.addEventListener('resize', function () { viewport.style.height = pages[current].offsetHeight + 'px'; });
			pages.forEach(function (pg) {
				pg.querySelectorAll('img').forEach(function (img) {
					if (!img.complete) img.addEventListener('load', function () { viewport.style.height = pages[current].offsetHeight + 'px'; });
				});
			});
		});
	}

	// ---------------------------------------------------------------- 语言切换按钮（EN / 中文）
	// 按钮由 static-export-i18n.php 输出在页面底部（隐藏），这里把它放到页头购物车图标旁边（电脑版和手机版页头各一个）。
	function initLangSwitch() {
		var src = document.querySelector('#yl-lang-switch a');
		if (!src) return;
		src.textContent = src.getAttribute('data-yl-label') || '';
		src.title = src.getAttribute('data-yl-title') || '';
		var css = document.createElement('style');
		css.textContent =
			'.yl-lang-link{display:inline-flex;align-items:center;justify-content:center;height:26px;min-width:40px;padding:0 10px;' +
			'margin:0 6px;border:1px solid currentColor;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.04em;' +
			'line-height:1;color:inherit;text-decoration:none;opacity:.75;transition:opacity .2s,background-color .2s;white-space:nowrap}' +
			'.yl-lang-link:hover,.yl-lang-link:focus-visible{opacity:1;background:rgba(0,0,0,.05)}';
		document.head.appendChild(css);
		var placed = 0;
		// Astra 主题（main、metis）：电脑版放在菜单右边，手机版放在菜单按钮左边
		document.querySelectorAll('#ast-desktop-header, #ast-mobile-header').forEach(function (dev) {
			var right = dev.querySelector('.site-header-primary-section-right');
			if (!right || right.querySelector('.yl-lang-link')) return;
			var a = src.cloneNode(true);
			right.insertBefore(a, right.querySelector('[data-section="section-header-mobile-trigger"]'));
			placed++;
		});
		if (placed) return;
		// Blocksy 主题（legacy）：电脑版、手机版页头各放一个：有购物车图标就放在它旁边，没有就放在菜单按钮前面
		var devices = document.querySelectorAll('header#header [data-device]');
		(devices.length ? devices : [document.querySelector('header') || document.body]).forEach(function (dev) {
			if (dev.querySelector('.yl-lang-link')) return;
			var anchor = dev.querySelector('.ct-header-cart') || dev.querySelector('.ct-header-trigger');
			if (!anchor) return;
			var a = src.cloneNode(true);
			anchor.parentNode.insertBefore(a, anchor.parentNode.querySelector(':scope > .ct-header-search') || anchor);
			placed++;
		});
		if (!placed) {   // 页头没有购物车图标的站点：放在页头最右侧
			var end = document.querySelector('header [data-column="end"] [data-items]');
			if (end) end.appendChild(src.cloneNode(true));
		}
	}

	// ---------------------------------------------------------------- 启动
	initLangSwitch();
	// 轮播在 WooCommerce 的交互脚本接管页面之前就整理好（本脚本位于页面底部，上面的内容都已加载）
	initCarousels();
	function init() { captureTemplates(); render(); }
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
	// 在别的标签页改了购物车，这里同步更新
	window.addEventListener('storage', function (e) { if (e.key === KEY) render(); });
})();
