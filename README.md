# Business Tycoon

A browser business simulator. You start with **$5,000** and build an empire any way you like. It's plain HTML/CSS/JS with no build step or dependencies: open `index.html` in a browser.

## Ways to make money

| Route | What you do |
|---|---|
| 💼 **9–5 job** | Clock in and click **WORK**. Each click is one minute of your shift (9 AM–5 PM = 480 clicks), and the game clock pauses while you're at the office. Pay starts at **1¢ per click**, and promotions based on career clicks take you from Intern to Vice President at **40¢ per click** |
| 📈 **Stocks** | 14 companies across 9 sectors, with daily price moves, news events, crashes, rallies and quarterly dividends |
| 🪙 **Crypto** | 6 volatile coins, including a meme coin that can moon or get rugged |
| 🧪 **Startups** | Angel-invest in pitches. Most fail, a few return 10–60× |
| 🍽️ **Restaurants** | Food truck → café → diner → sushi → fine dining → burger franchise. Hire and pay cooks, waiters, cleaners and managers. Set prices and ingredient quality, run marketing, renovate, or work shifts yourself |
| 🏭 **Factories & R&D** | Commodity plants (plastic, steel, aluminum, wire, wafers, glass, batteries, cups, toys) feed a **Design Studio** where you create your own products and pay R&D to develop them: **chips** (28nm→3nm, Efficient / Balanced / Super chip, 2–16 cores), **car engines** (I4, V6, V8, electric), **jet engines** (15k–100k lbf; turbojet, turbofan or geared), **cars**, **phones** and **aircraft** (50–600 seats, range, twin or four engines). Use your own parts or buy off-the-shelf ones (stock engines, licensed turbofans, generic chips). Most products need **certification** before production (FAA type certificate for aircraft, FAA engine certification, safety & emissions, FCC), and certification can fail. Each design needs its own production line, and the chip fab must be upgraded for smaller process nodes. Prices drop as you flood the market with one design, so a range of designs sells best |
| 🚗 **Scrapyard** | Buy junk cars at auction, crush them for metal and parts, or repair and flip them. Rare barn finds show up now and then |
| 🏘️ **Real estate** | Buy property, set rent levels, keep tenants happy, renovate, evict, or develop new buildings from scratch |
| 🏎️ **Racing** | Buy and tune cars and enter races, from track days to the Grand Prix. Bet on yourself or hire a pro driver. Underground races pay more but can get raided by police |
| 🎰 **Casino** | Plinko (3 risk levels), slots, roulette, blackjack, crash, dice and a weekly lottery |
| 🏦 **Bank** | Loans with a credit limit tied to your net worth, plus a savings account |
| 🏢 **Running costs** | Opening any business costs **equipment + a permit/license** (from a $400 food vendor license to a $5M FAA production certificate) **+ premises**: rent them (30-day deposit plus daily rent) or buy them outright (no rent, small property tax, value follows the housing market). You can buy rented premises later. Every day you pay **electricity, water, gas, internet & phone, waste disposal and insurance**, scaled to how busy the business is. Utility prices swing with heatwaves, droughts and pipeline outages. Insurance covers most of the cost of fires and accidents. Race cars cost garage space and insurance, landlords pay property tax and utilities on vacant units, and you pay your own **living costs** (parents' basement → mansion), which set your daily energy |
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
js/premises.js    premises (rent/buy), permits, utility bills, living costs
js/markets.js     stocks, crypto, startups
js/restaurants.js restaurants
js/factories.js   commodity plants, design studio, R&D, certification, product lines
js/scrapyard.js   scrapyard
js/realestate.js  property & landlord
js/racing.js      racing & race betting
js/casino.js      casino games
js/finance.js     bank, taxes & audits
js/job.js         the 9–5 clicker job
js/main.js        dashboard, events, achievements, day loop, rendering
```

Each feature file calls `registerModule({ init, start, daily, late, assets, tabs, actions })`, so new features plug in without touching the core loop.
