export default async (request) => {
  const headers = { "Content-Type": "application/json" };

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false }),
      { status: 405, headers }
    );
  }

  try {
    const { studentId, studentName, grade, score, testDate } =
      await request.json();

    if (
      !studentId ||
      !studentName ||
      !grade ||
      !Number.isInteger(score) ||
      score < 0 ||
      score > 20 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(testDate || "")
    ) {
      return new Response(
        JSON.stringify({ success: false }),
        { status: 400, headers }
      );
    }

    const token = Netlify.env.get("AIRTABLE_TOKEN");
    const baseId = Netlify.env.get("AIRTABLE_BASE_ID");
    const tableName = Netlify.env.get("AIRTABLE_TABLE_NAME");

    if (!token || !baseId || !tableName) {
      return new Response(
        JSON.stringify({ success: false }),
        { status: 500, headers }
      );
    }

    const esc = value =>
      String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    const formula =
      `AND({الرقم التعريفي}='${esc(studentId)}',` +
      `{اسم الطالبة}='${esc(studentName)}',` +
      `{الصف}='${esc(grade)}')`;

    const listUrl = new URL(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`
    );

    listUrl.searchParams.set("filterByFormula", formula);
    listUrl.searchParams.set("maxRecords", "2");

    const lookup = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const lookupData = await lookup.json();

    if (!lookup.ok || !lookupData.records ||
        lookupData.records.length !== 1) {
      return new Response(
        JSON.stringify({ success: false }),
        { status: 404, headers }
      );
    }

    const recordId = lookupData.records[0].id;

    const updateUrl =
      `https://api.airtable.com/v0/${baseId}/` +
      `${encodeURIComponent(tableName)}/${recordId}`;

    const update = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          "درجة الاختبار البعدي (من 20)": score,
          "تاريخ الاختبار": testDate
        }
      })
    });

    if (!update.ok) {
      return new Response(
        JSON.stringify({ success: false }),
        { status: 502, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false }),
      { status: 500, headers }
    );
  }
};
