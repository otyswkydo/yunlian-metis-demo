# METIS Academy Website Archive

English | [中文](README.zh-CN.md)

A sample website I built for **METIS Academy**, a real study-abroad organization, now preserved as a bilingual static site.

**Live demo:** https://otyswkydo.github.io/yunlian-metis-demo/ ([English version](https://otyswkydo.github.io/yunlian-metis-demo/en/))

- Online as a self-hosted WordPress site from **Sep 2025 to Aug 2026**
- My first practice website: simple, but the first time I went all the way from nothing to a working site
- Now a free static archive on GitHub Pages: 5 pages each in Chinese and English, 330 internal links checked, 0 broken

## About the project

METIS helps students, mostly high school students, come to Canada to study. I made this sample website for them to introduce the academy, its courses and activities, and give families a way to get in touch.

It ran on the same server as my other project, the [Canada-China Intangible Cultural Heritage Association website](https://github.com/otyswkydo/yunlian-legacy-demo), and it was my first practice site. There is no shop and no blog, just 5 pages (Home, About, Academics, Activities, Contact) and 36 images. It's simple, but it was the first time I took a website all the way from nothing to finished: starting from a blank WordPress, picking a template, swapping in METIS's own text and photos, adjusting the layout, and finally getting it live on its domain.

The site runs on WordPress with the [Astra](https://wpastra.com/) theme. The 5 pages started as an Astra template (Starter Templates) that I then changed into METIS's content, and the blocks on the pages come from the [Spectra](https://wpspectra.com/) plugin.

## Running and recovering the site

I did this part together with the heritage association's site, and the details are in [that project's README](https://github.com/otyswkydo/yunlian-legacy-demo#readme). In short:

- After testing, the site went live in September 2025 on the same cloud server as the heritage association's site, managed with 1Panel and Docker, with HTTPS through Cloudflare.
- When the server expired in August 2026, I kept a 7.5 GB snapshot of it and ran the recovery script Claude wrote on my own Mac, bringing all three sites back into Docker on my Mac. METIS was one of them.

## Turning it into a static site

The heritage association's site was exported first. I wanted to export METIS with the same scripts, so I first had Claude check whether they could be used as they were. The check showed those scripts were written around a different site: that one uses the Blocksy theme and has a shop and a cart, while METIS uses Astra and only has a contact form. So most of the work this time was finding what only fit the other site, and changing it so it works for both.

The result:

- 5 pages in each language plus a "page not found" page: 11 web pages, 164 files, 25 MB.
- Every page has an EN / 中文 switch in the header. The translations live in one lookup file with 57 entries: 51 translations (about 3,090 Chinese characters into about 1,880 English words), plus 6 entries that remove duplicate headings from the English version (see problem 2 below). I had Claude do the translation.
- The contact form looks the same as before. Pressing Submit shows a message saying forms can't be submitted on the static demo. Claude tested it in the browser, and submitting doesn't send any request.
- While browsing the preview, I noticed a course sign-up section on the home page that was no longer needed and decided to remove it before exporting. Claude removed it in WordPress (see problem 3 below).
- I had Claude write a link checker that starts from the home page and opens every link: 69 URLs and 330 link references, 0 broken.

## Problems I ran into

### 1. The same page saved twice

**The problem:** After Claude's first export, it found that next to `about/index.html` there was also an `about.html`. The same happened for `academics`, `activities` and `contact`, so there were 4 extra copies of pages.

**What I found:** Claude found that a few buttons on the home page linked to `href="about"`, without a `/` at the end. On the live site, WordPress quietly redirected `about` to `about/`, so visitors never noticed. But the export tool saw two different addresses and saved the same page twice.

**After the fix:** Claude suggested a fix, and after I approved it, I had Claude change the export so that internal links like this get the missing `/` added. Before, the Chinese version had 10 page files, 4 of them duplicates. After, there are 6, one for each page.

**What I learned:** Things that look the same to a person aren't always the same to a program. `about` and `about/` differ by one character, and to a program they are two different addresses.

### 2. The same heading twice in English

**The problem:** In the course section on the home page, every course has a Chinese title with the English title on the next line, like "计算机科学" above "Computer Science". If the English version translated the Chinese title too, it would show "Computer Science" twice.

**What I found:** On the page, the Chinese and English titles are two separate pieces of text, so the translation step only sees "计算机科学" and doesn't know the English is already there. Before translating, Claude checked what comes right after each short title, and found 6 of them: Humanities, Mathematics, Science, Computer Science, Languages and Fine Arts.

There was also a line, "📍 地址：123 Example Street, Toronto…" (a made-up address here), that never got translated. Claude spotted it while checking each English page after the export. The program saw mostly English letters and only a few Chinese characters, decided it was already English, and left it off the "still to translate" list.

**After the fix:** In the lookup file, a translation of `-` means "remove this from the English version". Claude used that for the 6 titles. Before, each course had two title lines in English; after, only the original English one is left. Claude also added the address line to the file by hand. In the end, the 5 English pages contain no Chinese at all, except the word "中文" on the language switch.

**What I learned:** "The program says everything is translated" doesn't mean everything is translated. The whole page still has to be checked again for anything that was missed.

### 3. Deleting one section almost broke the colours on the page

**The problem:** I wanted to remove the old course sign-up section from the home page, so I had Claude edit the home page content in WordPress directly with a command. The command succeeded and the section was gone.

**What I found:** Claude had backed up the database first, and afterwards compared the new content with the old one character by character. Something besides the section had changed: the colour settings.

WordPress stores a page's design settings (colours, font sizes and so on) as text in the database. In the colour names, the minus sign `-` isn't written directly. It's written as a code, `\u002d`. The backslash `\` at the start is a marker that means "the next few characters together stand for one symbol". When a browser reads `\u002d`, it knows that's a minus sign.

Before and after saving:

```text
Before: var(\u002d\u002dast-global-color-5)   the browser reads var(--ast-global-color-5), colour no. 5 in the theme
After:  var(u002du002dast-global-color-5)     the backslashes are gone, just plain letters, so the browser can't find the colour
```

Why did the backslashes disappear? WordPress has a habit when it saves content: it first removes one layer of backslashes from the text. When you click Save in the admin editor, the editor knows about this and adds an extra backslash in front of each one beforehand, so after one layer is removed, the original is still there. This time the content was saved directly from a command, with no extra backslash added, so the one that had to stay got removed too.

**After the fix:** Claude restored the database from the backup taken just before, then deleted the section again the right way, adding that extra layer before saving. Before the fix, all 26 colour settings on the home page were broken. After, 4 of them were gone along with the removed section, and the other 22 were intact. A character-by-character comparison confirmed that the only difference from the original was the removed section.

**What I learned:** Back up before changing data. And after a change, don't just check that there was no error. Check that it changed only what I meant to change. Those two steps are why this problem never made it into the exported site.

### 4. Code written for another site doesn't always fit

**The problem:** The export script, the publish script and the front-end code for the static site were all written for the heritage association's site. I wanted to use them for METIS as they were.

**What I found:** Before starting, I had Claude go through all of that code, and it found 5 places that only made sense for the heritage site. For example:

- The EN / 中文 switch looked for the cart icon in the Blocksy theme's header. METIS uses Astra and has no cart, so the switch would never appear.
- The form message said sign-in, registration, checkout and search weren't available. METIS has none of those.
- The publish script always created the GitHub repository with the description "加中非遗文化传承协会 · 静态演示站" (the heritage association's name).
- The export always fetched the cart and checkout pages. METIS doesn't have them, so every export logged 3 "not found" errors.

While testing in the browser, Claude also found a 404 error in the console. A script that shows emoji only loads while the page is running, so the export tool never found it.

**After the fix:** Claude listed its proposed fixes. I approved all of them, and added that it didn't need to copy the heritage site's approach exactly, since they're different sites. Then I had Claude make all of these depend on the site. Sites using Astra get the language switch too, sites without a shop say forms can't be submitted, the repository description and folder notes are set per site, cart pages are only fetched for sites with a shop, and the emoji script is exported as well. Before, exporting METIS gave 3 fetch errors and 1 console 404. After, both are 0. The heritage site works the same as before.

**What I learned:** Being able to reuse code doesn't mean you can copy it as is. Before using it somewhere new, look at what situation it was originally written for.

## Tech overview

- Website: WordPress, Astra theme, Spectra blocks
- Server (while it was live): Ubuntu, 1Panel, Docker, Cloudflare
- Recovery and export: Docker on OrbStack, WP-CLI, Bash, wget, Perl, PHP
- English version: a Chinese–English lookup file; the export builds the English pages under `/en/`
- Testing: a link checker (Python), plus testing in the browser on desktop and mobile
- Publishing: Git, GitHub CLI, GitHub Pages

## What I did and what Claude did

- What I did: set up the server; built the website starting from an Astra template, replaced the content, adjusted the layout and put it online; kept a full snapshot when the server expired; ran the recovery script Claude wrote on my own Mac; browsed the local preview and noticed the course section on the home page that was no longer needed.
- What I had Claude do: Claude wrote the recovery script, the export scripts, the link checker and the rest of the code. For this archive, Claude also ran the export, the link and privacy checks, the English translation and the browser tests, and removed the course section in WordPress.
- What I decided and approved: the repository name, keeping the contact email, making an English version, removing the course section, whether to go ahead with the fixes Claude proposed, and how each folder is described on GitHub. At every step I looked at Claude's results and confirmed them before moving on, and I ran the final publish command myself.

## Credits

The website describes METIS Academy, a real organization, and its content and branding belong to them. The page layouts come from an Astra template. This repository is a non-commercial archive and demo, and the contact form doesn't send anything.

Projects used: [WordPress](https://wordpress.org/), [Astra](https://wpastra.com/), [Spectra](https://wpspectra.com/), [1Panel](https://github.com/1Panel-dev/1Panel), [OrbStack](https://orbstack.dev/), [WP-CLI](https://wp-cli.org/), [GNU Wget](https://www.gnu.org/software/wget/), [GitHub Pages](https://pages.github.com/).
