# The Retention Lifecycle Framework: A Process for Improving User Retention

The goal is to get each bucket of users—your New Users, Current Users, and Resurrected Users to become highly engaged.

Instructional Designer

![The Retention Lifecycle Framework: A Process for Improving User Retention]
_This article is an excerpt from the first volume of **The Product Analytics Playbook: Mastering Retention**. [Customer retention] is the one metric that matters for sustainable growth. The Playbook is a comprehensive guide to understanding user retention that provides a novel framework for analyzing [retention rates] at every stage of the user journey._

---

Google “how to improve user retention” and you’ll come across hundreds if not thousands of tactics and strategies on how to do exactly that. There’s an overwhelming wealth of information on the kinds of marketing and product changes you can experiment with to get the boost in retention that you want.

What’s missing, however, is a systematic framework for improving retention that companies can continuously iterate on, as well as one that will work for companies at _any_ stage of growth. Over the past several months, we came up with framework to accomplish exactly that.

Once you’ve determined your product’s [**critical event**](https://amplitude.com/blog/2016/09/15/user-retention-app-critical-event) and its [**usage frequency**](https://amplitude.com/blog/2016/10/11/product-usage-interval), you can apply **The Retention Lifecycle Framework** to your users. (For a refresher on critical events and usage frequency, be sure to check out our previous [Retention Playbook excerpts](https://www.productanalyticsplaybook.com/).)

After investing time to [diagnose the state of your analytics](https://amplitude.com/blog/2016/08/25/how-to-audit-your-analytics) as well as your product’s usage, it’s time to dive into the meat of the Retention Playbook. In this excerpt, we’ll introduce the Retention Lifecycle Framework, our in-depth framework for improving retention based on how users interact with your product.

## The problem with the standard retention curve

By now, you’re probably familiar with analyzing a typical [retention curve](https://amplitude.com/blog/2016/01/27/understanding-user-retention), which shows a unit of time on the x-axis (usually number of days) and the percentage of active users on the y-axis.

![amplitude-retention-curve-print](https://amplitude.com/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Fl5rq9j6r%2Fproduction%2Fa1c69764781be0d5c54a5ccec82968a0d5088ddb-1733x788.png%3Ffp-x%3D0.5%26fp-y%3D0.5%26w%3D1733%26h%3D788%26q%3D85%26fit%3Dcrop%26crop%3Dfocalpoint%26auto%3Dformat&w=3840&q=75)

The fundamental problem with a retention curve like this is because it lumps together a lot of different _types_ of active users in one single curve.

In fact, not all active users are created equal. In order to get meaningful, long-term improvements to your retention, you need to understand your active users as they flow through different stages of being retained.

The Retention Lifecycle Framework can help you accomplish this goal.

## What is the Retention Lifecycle?

What do we mean when we talk about the “retention lifecycle?” The way we think about analyzing retention should change depending on what stage a user is at in their product journey. At Amplitude, we think of active users in three different retention stages: New User Retention, Current User Retention, and Resurrected User Retention .

- **New Users**: Users who are new.
- **Current Users**: Users who have been using your product consistently for some period of time.
- **Resurrected Users:** Users who were once actively using your product, who then became inactive for a period of time, and then became active again.

**These three groups make up your total active users at any given time.** If you’re a daily usage app, this means that on any given day, an active user of your app will be at the new, current, or resurrected user stage.

The image below maps how we think about the flow of users between these different stages of retention.

The main objective of the Retention Lifecycle Framework, and the Retention Playbook as a whole, is to get your existing New, Current, and Resurrected Users to become more engaged Current Users.

To achieve retention that rivals the likes of Snapchat and Instagram, you have to engage differently with new users and current users, put strategies in place to resurrect inactive users, and move all of your users toward being more engaged overall.

Let’s look at each of the different stages in the Retention Lifecycle in more detail.

### New User Retention

A lot of the existing content about improving user retention actually focuses on how to retain _new_ users—things like revamping your onboarding flow or sending new user drip campaigns, for example. This makes a lot of sense, since so many users churn within the first 7 days. But _not_ focusing on engaging your current users or finding ways to resurrect inactive users would be a huge wasted opportunity.

- **Why it matters**: New User Retention is your product’s first impression.
- **How to improve**: Figure out how to get users to come back.

### Current User Retention

Don’t take your current users for granted. Every current user has the opportunity to turn into a highly-engaged power user. Your goal for current users is to continue providing them with value and keep them coming back.

- **Why it matters:** Improving the experience for current users is critical for long-term growth
- **How to improve**: Figure out what your users are (and aren’t) doing.

In an future Playbook excerpt we’ll talk about how to categorize your users into different **behavioral personas**, which can help you further understand and capitalize on the value (or values) that users derive from your product.

### Resurrected User Retention

Churned users are, in fact, the largest percentage of most products’ potential user pool. Many of these users are probably using a competitor’s product, so they’re high value as well. There are also numerous studies that show that it’s cheaper to resurrect a churned user than it is to acquire one.

- **Why it matters:** Untapped potential for more active users
- **How to improve:** Analyze why users are coming back.

When you find that more churned users are coming back to your product, it’s important to invest time into figuring out _why_. Did they respond to a particular winback campaign? Push notification? Did they become current users or did they drop off again?

## Why do you need the Retention Lifecycle Framework?

Why does this Retention Lifecycle matter? Because too many products try to artificially increase their active user counts through simply acquiring new users. Of course, top of the funnel is important (if you can’t attract new users you have no one to retain) but the growth of your current and resurrected user base is what really matters for [sustainable growth]

In Amplitude, the Growth Accounting feature can automatically break down your user base into New, Resurrected, Current, and Churned users.

Instead of viewing just a daily (or weekly, monthly) active user chart over time, the stacked bar chart lets you track how the proportion of your active user base, as well as your churned user base, is changing with each successive usage period.

### The Quick Ratio gives you a pulse on your growth

In addition, Amplitude can depict these different groups of users as a [**Quick Ratio**](https://www.slideshare.net/03133938319/saastr)\*\*.

The Quick Ratio describes the ratio of **user influx to user churn**. It’s calculated as follows:

Quick Ratio = (New Users + Resurrected Users) / Churned Users

Since both newly acquired users and resurrected users increase the pool of active users, they are part of the “user influx” group.

The Quick Ratio is useful for giving you a “quick” pulse on your product’s growth.

- **Quick Ratio > 1** indicates that you’re gaining more users than losing them, which means your app is experiencing growth.
- **Quick Ratio < 1** indicates you’re losing more users than gaining them, which means your app _isn’t_ growing

In the example below, this music streaming app is losing a lot more users than it is gaining on October 29 because the Quick Ratio < 1. The opposite is true for October 31; the Quick Ratio is greater than 2 on that day, indicating that for every one user the app loses, you’re actually gaining 2 more. That is true growth.

## Summary

The purpose of this excerpt was to introduce the Retention Lifecycle Framework. Whichever [retention analysis](https://amplitude.com/blog/2016/08/11/3-ways-measure-user-retention) you choose for your business, the framework remains the same. The goal is to get each bucket of users—your New Users, Current Users, and Resurrected Users to become highly engaged users.

- New Users→ Current User→ Highly Engaged Users
- Resurrected Users→ Current Users→ Highly Engaged Users
- Current Users→ Highly Engaged Users

Over the next several weeks, we will explain the deeper nuances of New, Current, and Resurrected User Retention.
