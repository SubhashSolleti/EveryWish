Build an application for scheduling and automatically sending personal wishes to loved ones based on their local time zones.

The core use case is birthdays.

Example:

I live in India and my sister's birthday is October 6. She has lived in different places such as India, New York, and California.

I want to write ONE birthday message:

"Happy Birthday ❤️ I hope you have an amazing year!"

I should then be able to choose the date:

October 6

Choose the local delivery time:

12:00 AM

Then select the time zones in which I want the wish to be delivered:

- India
- New York
- California

The application should understand that these are three separate local-time delivery events.

The same message should therefore be delivered to the same WhatsApp recipient three times:

1. When October 6, 12:00 AM arrives in India
2. When October 6, 12:00 AM arrives in New York
3. When October 6, 12:00 AM arrives in California

The user should not need to manually calculate time differences.

The application should show the user a clear preview before scheduling:

India
October 6 — 12:00 AM local time

New York
October 6 — 12:00 AM local time

California
October 6 — 12:00 AM local time

The user should also be able to select additional time zones, for example:

- London
- Dubai
- Singapore
- Tokyo
- Sydney
- Any other supported timezone

There should be an option to select all supported time zones.

"Select all" means the same wish should be delivered once when the selected date/time occurs in each supported timezone.

The user should be able to see exactly how many deliveries will occur.

For example:

3 time zones selected
3 deliveries scheduled

The user should be able to create multiple wishes for the same recipient and occasion.

Example:

Wish 1:
"Happy Birthday ❤️"

Wish 2:
"Hope you have a beautiful day!"

Each wish can have its own scheduling configuration.

The application should support different occasions, not only birthdays.

Examples:

- Birthday
- Anniversary
- Festival
- New Year
- Valentine's Day
- Graduation
- Custom occasion
- Any personal reminder or wish

The user should be able to create a recurring yearly birthday wish.

For example:

Recipient: Sister
Occasion: Birthday
Date: October 6
Time: 12:00 AM
Time zones: India, New York, California
Message: Happy Birthday ❤️

After scheduling, the application should remember the configuration and automatically prepare the next year's deliveries.

The user should be able to:

- Create a wish
- Preview all planned deliveries
- Edit a wish
- Cancel a wish
- Duplicate a wish
- Change selected time zones
- Change the delivery time
- Change the recipient
- Change the message
- View upcoming scheduled wishes
- View completed deliveries
- View failed deliveries

The main dashboard should make the concept immediately understandable.

Example:

Sister's Birthday
October 6

🎂 Happy Birthday ❤️

3 time zones
3 deliveries

🇮🇳 India — 12:00 AM
🇺🇸 New York — 12:00 AM
🇺🇸 California — 12:00 AM

The application should make it obvious that "12:00 AM" means midnight in EACH selected timezone, not midnight in the sender's timezone.

For the MVP, WhatsApp is the delivery channel.

The user enters/selects the WhatsApp recipient and writes the message.

The product should be designed so that the same scheduling experience can eventually support additional delivery channels such as SMS, email, Telegram, push notifications, or other messaging platforms.

The experience should feel like:

Write once → Choose when → Choose where in the world → Schedule → Forget about it.

Do not add unnecessary enterprise features.

Prioritize making the core timezone-based wishing experience extremely simple, obvious, reliable, and pleasant.

Before implementing complex functionality, make sure the basic end-to-end user flow works:

Create wish
→ select recipient
→ write message
→ select date
→ select local delivery time
→ select one or more time zones
→ preview deliveries
→ confirm schedule
→ show scheduled wishes
→ execute each delivery at the appropriate local time
→ show delivery status.

The application should be built so that timezone complexity is completely hidden from the normal user experience.

A normal user should never need to understand UTC offsets, daylight saving time, timezone conversion, or date-line behavior.

The application should handle those details automatically.