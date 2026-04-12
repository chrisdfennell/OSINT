// Curated list of public 24/7 YouTube live webcams with lat/lon so they can
// be mapped. Uses channel-based embed (youtube.com/embed/live_stream?channel=)
// which stays valid while the channel has exactly one active livestream.
// If an embed stops working, swap the channel ID.

export const webcams = [
    // ── United States ──
    {
        id: 'times-square',
        name: 'Times Square, NYC',
        lat: 40.757989, lon: -73.985798,
        channel: 'UCGdqH-QKkSJIZVAsDE7cEMQ',
        url: 'https://www.youtube.com/@earthcam/live',
        featured: true,
    },
    {
        id: 'jackson-hole',
        name: 'Jackson Hole Town Square',
        lat: 43.479491, lon: -110.762484,
        channel: 'UC0QQGFhD26j8e1UjoTVVGnA',
        url: 'https://www.youtube.com/@SeeJH/live',
        featured: true,
    },
    {
        id: 'katmai-bears',
        name: 'Katmai Brown Bears, Alaska',
        lat: 58.559722, lon: -155.779722,
        channel: 'UCAbN_QDyakL8iMsOyEvh2WA',
        url: 'https://explore.org/livecams/brown-bears',
        featured: true,
    },
    {
        id: 'venice-beach',
        name: 'Venice Beach, CA',
        lat: 33.985, lon: -118.473,
        channel: 'UCGdqH-QKkSJIZVAsDE7cEMQ',
        url: 'https://www.youtube.com/@earthcam/live',
    },
    {
        id: 'niagara-falls',
        name: 'Niagara Falls',
        lat: 43.0896, lon: -79.0849,
        channel: 'UCGdqH-QKkSJIZVAsDE7cEMQ',
        url: 'https://www.youtube.com/@earthcam/live',
    },
    {
        id: 'vegas-strip',
        name: 'Las Vegas Strip',
        lat: 36.1215, lon: -115.1739,
        channel: 'UCGdqH-QKkSJIZVAsDE7cEMQ',
        url: 'https://www.youtube.com/@earthcam/live',
    },

    // ── Europe ──
    {
        id: 'abbey-road',
        name: 'Abbey Road Crossing, London',
        lat: 51.5320, lon: -0.1781,
        channel: 'UCL3sFV4Y-5wmwq7mc5Otjtg',
        url: 'https://www.abbeyroad.com/crossing',
        featured: true,
    },
    {
        id: 'dublin-temple-bar',
        name: 'Temple Bar, Dublin',
        lat: 53.3454, lon: -6.2636,
        channel: 'UCWCmM4_5cAZ-aI-0nGF2yGQ',
        url: 'https://www.youtube.com/@thetempplebartradpub/live',
    },
    {
        id: 'venice-italy',
        name: 'Venice, Italy',
        lat: 45.4371, lon: 12.3356,
        channel: 'UCGdqH-QKkSJIZVAsDE7cEMQ',
        url: 'https://www.youtube.com/@earthcam/live',
    },
    {
        id: 'santorini',
        name: 'Santorini, Greece',
        lat: 36.4618, lon: 25.3753,
        channel: 'UCnj7qLNoFxBqrtM7ltwQSKA',
        url: 'https://www.youtube.com/@SkylineWebcams/live',
    },
    {
        id: 'plaza-mayor',
        name: 'Plaza Mayor, Madrid',
        lat: 40.4155, lon: -3.7074,
        channel: 'UCnj7qLNoFxBqrtM7ltwQSKA',
        url: 'https://www.youtube.com/@SkylineWebcams/live',
    },

    // ── Asia / Pacific ──
    {
        id: 'shibuya',
        name: 'Shibuya Crossing, Tokyo',
        lat: 35.6595, lon: 139.7004,
        channel: 'UCUeUPuNJnL5zT3tqTZpFRfA',
        url: 'https://www.youtube.com/@livecamerajp.5431/live',
        featured: true,
    },
    {
        id: 'bangkok-traffic',
        name: 'Bangkok Traffic',
        lat: 13.7563, lon: 100.5018,
        channel: 'UCGdqH-QKkSJIZVAsDE7cEMQ',
        url: 'https://www.youtube.com/@earthcam/live',
    },
    {
        id: 'sydney-harbour',
        name: 'Sydney Harbour',
        lat: -33.857, lon: 151.215,
        channel: 'UCGdqH-QKkSJIZVAsDE7cEMQ',
        url: 'https://www.youtube.com/@earthcam/live',
    },

    // ── Wildlife / nature ──
    {
        id: 'african-watering-hole',
        name: 'African Watering Hole (Tembe, SA)',
        lat: -26.9447, lon: 32.4163,
        channel: 'UCAbN_QDyakL8iMsOyEvh2WA',
        url: 'https://explore.org/livecams/african-wildlife',
    },
    {
        id: 'old-faithful',
        name: 'Old Faithful, Yellowstone',
        lat: 44.4605, lon: -110.8281,
        channel: 'UCAbN_QDyakL8iMsOyEvh2WA',
        url: 'https://www.nps.gov/yell/learn/photosmultimedia/webcams.htm',
    },
];
