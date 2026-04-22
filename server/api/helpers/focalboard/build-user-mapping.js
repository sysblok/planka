/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @description :: Maps Focalboard users to Planka users by username/email.
 *                 Returns mapping and stats.
 */

module.exports = {
  inputs: {
    focalboardUsers: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard user objects from export',
    },
  },

  exits: {
    success: {
      description: 'User mapping created successfully',
    },
  },

  async fn(inputs) {
    const { focalboardUsers } = inputs;

    const mapping = {
      focalboardUserIdToPlankaUserId: {},
      unmatchedUsers: [],
      duplicateWarnings: [],
      stats: {
        total: focalboardUsers.length,
        matchedByUsername: 0,
        matchedByEmail: 0,
        unmatched: 0,
        duplicates: 0,
      },
    };

    console.log('');
    console.log('=== Building User Mapping ===');
    console.log(`Total Focalboard users: ${focalboardUsers.length}`);

    for (const fbUser of focalboardUsers) {
      const { userId, username, email, firstname, lastname } = fbUser;

      let plankaUser = null;
      let matchMethod = null;

      // Try matching by username first
      if (username) {
        const usersByUsername = await User.find({ username });

        if (usersByUsername.length === 1) {
          plankaUser = usersByUsername[0];
          matchMethod = 'username';
          mapping.stats.matchedByUsername++;
        } else if (usersByUsername.length > 1) {
          // Multiple users with same username - try to disambiguate by email
          if (email) {
            const exactMatch = usersByUsername.find(u => u.email === email);
            if (exactMatch) {
              plankaUser = exactMatch;
              matchMethod = 'username+email';
              mapping.stats.matchedByUsername++;

              console.warn(
                `⚠️  Multiple users with username "${username}", matched by email: ${email}`
              );
              mapping.duplicateWarnings.push({
                focalboardUserId: userId,
                username,
                email,
                matchedPlankaUserId: exactMatch.id,
              });
              mapping.stats.duplicates++;
            } else {
              console.warn(
                `⚠️  Multiple users with username "${username}", no email match. Skipping.`
              );
              mapping.stats.duplicates++;
              mapping.stats.unmatched++;
              mapping.unmatchedUsers.push(fbUser);
              continue;
            }
          } else {
            console.warn(
              `⚠️  Multiple users with username "${username}", no email to disambiguate. Skipping.`
            );
            mapping.stats.duplicates++;
            mapping.stats.unmatched++;
            mapping.unmatchedUsers.push(fbUser);
            continue;
          }
        }
      }

      // Fallback: try matching by email
      if (!plankaUser && email) {
        plankaUser = await User.findOne({ email });
        if (plankaUser) {
          matchMethod = 'email';
          mapping.stats.matchedByEmail++;
        }
      }

      // Store mapping or mark as unmatched
      if (plankaUser) {
        mapping.focalboardUserIdToPlankaUserId[userId] = plankaUser.id;

        const displayName = firstname || lastname
          ? `${firstname} ${lastname}`.trim()
          : username || email;

        console.log(
          `✓ Matched: ${displayName} (${matchMethod}) → Planka user ${plankaUser.id}`
        );
      } else {
        mapping.stats.unmatched++;
        mapping.unmatchedUsers.push(fbUser);
      }
    }

    console.log('');
    console.log('--- User Mapping Summary ---');
    console.log(`Total users: ${mapping.stats.total}`);
    console.log(`  Matched by username: ${mapping.stats.matchedByUsername}`);
    console.log(`  Matched by email: ${mapping.stats.matchedByEmail}`);
    console.log(`  Unmatched (skipped): ${mapping.stats.unmatched}`);
    console.log(`  Duplicate username warnings: ${mapping.stats.duplicates}`);
    console.log('');

    return mapping;
  },
};
