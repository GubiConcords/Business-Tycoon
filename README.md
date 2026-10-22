# Business Tycoon

A browser business simulator. You start with **$5,000** and build an empire any way you like. It's plain HTML/CSS/JS with no build step or dependencies: open `index.html` in a browser.

## Ways to make money

| Route | What you do |
|---|---|
| 📈 **Stocks** | 14 companies across 9 sectors, with daily price moves, news events, crashes, rallies and quarterly dividends |
| 🪙 **Crypto** | 6 volatile coins, including a meme coin that can moon or get rugged |
| 🧪 **Startups** | Angel-invest in pitches. Most fail, a few return 10–60× |
| 🍽️ **Restaurants** | Food truck → café → diner → sushi → fine dining → burger franchise. Hire and pay cooks, waiters, cleaners and managers. Set prices and ingredient quality, run marketing, renovate, or work shifts yourself |
| 🏭 **Factories** | A full production chain: crude oil → plastic → cups and toys; sand → wafers → chips → circuit boards and processors → smartphones, EVs, jet engines, avionics → **airliners** ✈️. Includes a commodity market, auto-buy/auto-sell and upgrades |
| 🚗 **Scrapyard** | Buy junk cars at auction, crush them for metal and parts, or repair and flip them. Rare barn finds show up now and then |
| 🏘️ **Real estate** | Buy property, set rent levels, keep tenants happy, renovate, evict, or develop new buildings from scratch |
| 🏎️ **Racing** | Buy and tune cars and enter races, from track days to the Grand Prix. Bet on yourself or hire a pro driver. Underground races pay more but can get raided by police |
| 🎰 **Casino** | Plinko (3 risk levels), slots, roulette, blackjack, crash, dice and a weekly lottery |
| 🏦 **Bank** | Loans with a credit limit tied to your net worth, plus a savings account |
| 🧾 **Taxes & risk** | Business profits are taxed weekly. Pay honestly, use creative accounting, or set up an offshore shell company. Each step down that path raises your audit risk, and audits are expensive |

Also included: energy-based hustles, random events (health inspectors, critics, viral posts, fires, lawsuits, inheritances), 29 achievements, a net worth chart, an event log and autosave to `localStorage`.

## Controls

- **Speed buttons** (top right) or **Space** to pause or resume. **N** advances one day.
- You get **100⚡ energy** per day for hands-on work (hustles, restaurant shifts, scrapyard work, driving races).
- Going bankrupt (net worth below −$50K with no cash) ends the game.

## Code layout

```
index.html        page shell
style.css         styles (dark theme, responsive)
js/util.js        helpers, modals, toasts, charts, module registry
js/state.js       game state, money helpers, save/load
js/markets.js     stocks, crypto, startups
js/restaurants.js restaurants
js/factories.js   manufacturing chain & commodity market
js/scrapyard.js   scrapyard
js/realestate.js  property & landlord
js/racing.js      racing & race betting
js/casino.js      casino games
js/finance.js     bank, taxes & audits
js/main.js        dashboard, events, achievements, day loop, rendering
```

Each feature file calls `registerModule({ init, start, daily, late, assets, tabs, actions })`, so new features plug in without touching the core loop.
