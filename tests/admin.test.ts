import { test } from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './support/database';
const admin = '00000000-0000-4000-8000-000000000031',
  member = '00000000-0000-4000-8000-000000000032',
  guest = '00000000-0000-4000-8000-000000000033';
test('Admin functions answer administrators only, and protect roles, reviews, meet-ups and the inbox', async () => {
  const db = await testDatabase();
  async function asUser(user: string, query: string, args: unknown[] = []) {
    await db.exec('BEGIN');
    try {
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user]);
      await db.exec('SET LOCAL ROLE authenticated');
      const rows = (await db.query<Record<string, unknown>>(query, args)).rows;
      await db.exec('COMMIT');
      return rows;
    } catch (e) {
      await db.exec('ROLLBACK');
      throw e;
    }
  }
  const value = async (user: string, query: string, args: unknown[] = []) =>
    (await asUser(user, query, args))[0].value as Record<string, unknown>;
  const denied = (user: string, query: string, args: unknown[] = []) =>
    assert.rejects(asUser(user, query, args), /Administrator required/, query);
  try {
    await db.query(
      `INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
       ($1,'admin@test.example','{"display_name":"Ada"}'),($2,'member@test.example','{"display_name":"Mia"}'),
       ($3,'guest@test.example','{"display_name":"Gus"}')`,
      [admin, member, guest],
    );
    await db.query("UPDATE mt_profiles SET role='admin' WHERE id=$1", [admin]);

    // Every read and write is refused to someone who is not an administrator.
    for (const query of [
      'SELECT mt_admin_overview()',
      "SELECT mt_admin_users('', '', '', 'newest', 0, 20)",
      'SELECT mt_admin_user($1::uuid)',
      "SELECT mt_admin_set_role($1::uuid, 'admin')",
      "SELECT mt_admin_reviews('', 0, '', 'newest', 0, 20)",
      "SELECT mt_admin_messages('', '', 'newest', 0, 20)",
      "SELECT mt_admin_meetups('', '', NULL, NULL, NULL, 'soonest', 0, 20)",
      "SELECT mt_admin_meetup_export('', '', NULL, NULL, NULL)",
      "SELECT mt_admin_log_list('', '', 0, 20)",
      "SELECT mt_admin_log_write('users.role', 'user', 'x', 'Tried')",
    ])
      await denied(member, query, query.includes('$1') ? [member] : []);
    await assert.rejects(asUser(member, 'SELECT * FROM mt_admin_log'), /permission denied/);
    await assert.rejects(asUser(member, 'SELECT * FROM mt_contact_messages'), /permission denied/);

    // Accounts: search, filters and the role rules.
    const users = await value(
      admin,
      "SELECT mt_admin_users('mia', '', '', 'name', 0, 20) AS value",
    );
    assert.equal(users.total, 1);
    assert.equal((users.rows as { email: string }[])[0].email, 'member@test.example');
    const admins = await value(
      admin,
      "SELECT mt_admin_users('', 'admin', '', 'name', 0, 20) AS value",
    );
    assert.deepEqual(
      (admins.rows as { id: string }[]).map((row) => row.id),
      [admin],
    );
    await assert.rejects(
      asUser(admin, "SELECT mt_admin_set_role($1::uuid, 'user')", [admin]),
      /cannot change their own role/,
    );
    await asUser(admin, "SELECT mt_admin_set_role($1::uuid, 'admin')", [member]);
    await asUser(member, "SELECT mt_admin_set_role($1::uuid, 'user')", [member]).then(
      () => assert.fail('self demotion must fail'),
      (error) => assert.match(String(error), /own role/),
    );
    await asUser(admin, "SELECT mt_admin_set_role($1::uuid, 'user')", [member]);
    await db.query("UPDATE auth.users SET banned_until=now()+interval '1 year' WHERE id=$1", [
      guest,
    ]);
    const suspended = await value(
      admin,
      "SELECT mt_admin_users('', '', 'suspended', 'newest', 0, 20) AS value",
    );
    assert.deepEqual(
      (suspended.rows as { id: string }[]).map((row) => row.id),
      [guest],
    );
    // A wildcard in the search is literal text, not "match everything".
    assert.equal(
      (await value(admin, "SELECT mt_admin_users('%', '', '', 'newest', 0, 20) AS value")).total,
      0,
    );
    await assert.rejects(
      asUser(admin, "SELECT mt_admin_users('', '', '', 'newest', 0, 500)"),
      /Invalid page/,
    );

    // Reviews: a hidden review leaves the place page and the community rating, and comes back when shown.
    const placeId = (
      await db.query<{ id: number }>('SELECT id FROM mt_places WHERE published LIMIT 1')
    ).rows[0].id;
    await asUser(member, 'SELECT mt_community_write($1,$2::jsonb)', [
      'review',
      JSON.stringify({ placeId, rating: 1, body: 'Rude staff and a long wait.' }),
    ]);
    const reviewId = (
      await value(admin, "SELECT mt_admin_reviews('rude', 0, '', 'newest', 0, 20) AS value")
    ).rows as { id: number }[];
    assert.equal(reviewId.length, 1);
    await asUser(admin, "SELECT mt_admin_review_write('hide', $1)", [reviewId[0].id]);
    const page = await value(member, 'SELECT mt_place_community($1, 0) AS value', [placeId]);
    assert.equal((page.reviews as unknown[]).length, 0);
    assert.equal(page.count, 0);
    assert.equal(
      (await value(admin, "SELECT mt_admin_reviews('', 0, 'hidden', 'newest', 0, 20) AS value"))
        .total,
      1,
    );
    await asUser(admin, "SELECT mt_admin_review_write('show', $1)", [reviewId[0].id]);
    assert.equal(
      (await value(member, 'SELECT mt_place_community($1, 0) AS value', [placeId])).count,
      1,
    );
    await asUser(admin, "SELECT mt_admin_review_write('delete', $1)", [reviewId[0].id]);
    await assert.rejects(
      asUser(admin, "SELECT mt_admin_review_write('delete', $1)", [reviewId[0].id]),
      /Review not found/,
    );

    // Meet-ups: listing, the capacity rule when accepting, cancelling, reopening and the export.
    await db.query('UPDATE mt_profiles SET email_verified_at=now() WHERE id IN ($1,$2)', [
      member,
      guest,
    ]);
    await db.query('UPDATE auth.users SET banned_until=NULL WHERE id=$1', [guest]);
    const event = (
      await db.query<{ id: number }>(
        `INSERT INTO mt_events(creator_id,title,location,lat,lng,starts_at,price,capacity,description,expires_at)
         VALUES($1,'Sunrise hike','Morne Larcher',14.45,-61.05,now()+interval '3 days',15,2,
         'A gentle sunrise hike with a picnic at the top.',now()+interval '3 days') RETURNING id`,
        [member],
      )
    ).rows[0].id;
    await db.query(
      "INSERT INTO mt_event_applications(event_id,user_id,status) VALUES($1,$2,'pending'),($1,$3,'pending')",
      [event, guest, admin],
    );
    const meetups = await value(
      admin,
      "SELECT mt_admin_meetups('sunrise', 'live', NULL, NULL, NULL, 'soonest', 0, 20) AS value",
    );
    assert.equal(meetups.total, 1);
    assert.equal((meetups.rows as { pending: number }[])[0].pending, 2);
    await asUser(admin, "SELECT mt_admin_meetup_write('accepted', $1, $2::uuid)", [event, guest]);
    // Capacity 2 includes the host, so a second acceptance is refused.
    await assert.rejects(
      asUser(admin, "SELECT mt_admin_meetup_write('accepted', $1, $2::uuid)", [event, admin]),
      /Event is full/,
    );
    const detail = await value(admin, 'SELECT mt_admin_meetup($1) AS value', [event]);
    assert.equal(detail.host_email, 'member@test.example');
    assert.equal((detail.requests as unknown[]).length, 2);
    const exported = (
      await asUser(admin, "SELECT mt_admin_meetup_export('', '', NULL, NULL, NULL) AS value")
    )[0].value as { participant_email: string; request_status: string }[];
    assert.deepEqual(exported.map((row) => [row.participant_email, row.request_status]).sort(), [
      ['admin@test.example', 'pending'],
      ['guest@test.example', 'accepted'],
    ]);
    await asUser(admin, "SELECT mt_admin_meetup_write('cancel', $1)", [event]);
    await asUser(admin, "SELECT mt_admin_meetup_write('reopen', $1)", [event]);
    await db.query("UPDATE mt_events SET starts_at=now()-interval '1 hour' WHERE id=$1", [event]);
    await assert.rejects(
      asUser(admin, "SELECT mt_admin_meetup_write('reopen', $1)", [event]),
      /has ended/,
    );

    // Contact inbox: status changes and deletion; only the service role writes new messages.
    await assert.rejects(
      asUser(
        guest,
        "INSERT INTO mt_contact_messages(name,email,subject,message) VALUES('G','g@test.example','Hello','A message long enough.')",
      ),
      /permission denied/,
    );
    const messageId = (
      await db.query<{ id: number }>(
        "INSERT INTO mt_contact_messages(name,email,subject,message) VALUES('Gus','g@test.example','Opening hours','Is the distillery open on Sunday?') RETURNING id",
      )
    ).rows[0].id;
    assert.equal(
      (await value(admin, "SELECT mt_admin_messages('', 'new', 'newest', 0, 20) AS value")).unread,
      1,
    );
    await asUser(admin, "SELECT mt_admin_message_write('handled', $1)", [messageId]);
    assert.equal(
      (
        await value(
          admin,
          "SELECT mt_admin_messages('sunday', 'handled', 'newest', 0, 20) AS value",
        )
      ).total,
      1,
    );
    await asUser(admin, "SELECT mt_admin_message_write('delete', $1)", [messageId]);
    assert.equal(
      (await value(admin, "SELECT mt_admin_messages('', '', 'newest', 0, 20) AS value")).total,
      0,
    );

    // Site settings: anyone reads, only administrators change.
    await assert.rejects(
      asUser(member, `UPDATE mt_site_settings SET content='{"hero":{}}' RETURNING id`).then(
        (rows) => {
          if (!rows.length) throw new Error('no rows changed');
        },
      ),
      /no rows changed/,
    );
    assert.equal(
      (
        await asUser(
          admin,
          `UPDATE mt_site_settings SET content='{"hero":{"title":"Hi"}}' RETURNING id`,
        )
      ).length,
      1,
    );

    // The activity log records the acting administrator from the session, and the overview counts it.
    await asUser(
      admin,
      "SELECT mt_admin_log_write('users.role', 'user', $1, 'Made Mia an administrator', '{}')",
      [member],
    );
    const log = await value(admin, "SELECT mt_admin_log_list('', 'users', 0, 20) AS value");
    assert.equal((log.rows as { actor_email: string }[])[0].actor_email, 'admin@test.example');
    const overview = await value(admin, 'SELECT mt_admin_overview() AS value');
    assert.equal(overview.users, 3);
    assert.equal(overview.meetups, 1);
    assert.equal((overview.recentActivity as unknown[]).length, 1);

    // The account page sees only its owner's activity.
    const mine = await value(guest, 'SELECT mt_my_activity() AS value');
    assert.equal((mine.requests as { status: string }[])[0].status, 'accepted');
    assert.equal((mine.meetups as unknown[]).length, 0);
    assert.equal(
      ((await value(member, 'SELECT mt_my_activity() AS value')).meetups as unknown[]).length,
      1,
    );
  } finally {
    await db.close();
  }
});
