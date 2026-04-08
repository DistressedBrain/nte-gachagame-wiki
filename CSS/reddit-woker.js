export default {
    async fetch(request) {
        // Get the real URL from the 'url' parameter
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return new Response('Missing ?url= parameter', { status: 400 });
        }

        // Fetch the real data from Reddit
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)',
            },
        });

        // Create a new response with CORS headers (allows your page to read it)
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');

        return newResponse;
    },
};