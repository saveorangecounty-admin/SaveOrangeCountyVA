exports.handler = async function(event, context) {
  const FORM_ID = process.env.PLEDGE_FORM_ID || '';
  const TOKEN = process.env.NETLIFY_ACCESS_TOKEN || '';

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60'
  };

  if (!TOKEN) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: 'no_token', counts: {} })
    };
  }

  try {
    // First get the form ID if we don't have it cached
    let formId = FORM_ID;
    if (!formId) {
      const formsRes = await fetch('https://api.netlify.com/api/v1/sites/' + process.env.SITE_ID + '/forms', {
        headers: { 'Authorization': 'Bearer ' + TOKEN }
      });
      const forms = await formsRes.json();
      const pledgeForm = forms.find(f => f.name === 'pledges');
      if (!pledgeForm) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ error: 'form_not_found', counts: {} })
        };
      }
      formId = pledgeForm.id;
    }

    // Fetch all submissions (paginate if needed)
    let allSubs = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const subRes = await fetch(
        'https://api.netlify.com/api/v1/forms/' + formId + '/submissions?per_page=100&page=' + page,
        { headers: { 'Authorization': 'Bearer ' + TOKEN } }
      );
      const subs = await subRes.json();
      if (!Array.isArray(subs) || subs.length === 0) {
        hasMore = false;
      } else {
        allSubs = allSubs.concat(subs);
        if (subs.length < 100) hasMore = false;
        page++;
      }
      // Safety cap
      if (page > 50) hasMore = false;
    }

    // Count by district
    var counts = {
      'District 1': 0,
      'District 2': 0,
      'District 3': 0,
      'District 4': 0,
      'District 5': 0,
      'Not sure': 0
    };

    allSubs.forEach(function(sub) {
      var dist = (sub.data && sub.data.district) || (sub.human_fields && sub.human_fields.district) || '';
      if (counts.hasOwnProperty(dist)) {
        counts[dist]++;
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        counts: counts,
        total: allSubs.length,
        updated: new Date().toISOString()
      })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: err.message, counts: {} })
    };
  }
};
