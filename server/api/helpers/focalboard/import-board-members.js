/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @description :: Imports Focalboard board members as Planka BoardMembership records.
 */

module.exports = {
  inputs: {
    boardId: {
      type: 'string',
      required: true,
    },
    projectId: {
      type: 'string',
      required: true,
    },
    focalboardBoardMembers: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard boardMember objects',
    },
    userMapping: {
      type: 'ref',
      required: true,
      description: 'Mapping from Focalboard user IDs to Planka user IDs',
    },
    focalboardUsers: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard user objects (for username lookup)',
    },
  },

  async fn(inputs) {
    const { boardId, projectId, focalboardBoardMembers, userMapping, focalboardUsers } = inputs;

    // Build userId → username lookup
    const usernameByUserId = {};
    focalboardUsers.forEach((u) => {
      usernameByUserId[u.userId] = u.username || u.email || u.userId;
    });

    console.log('');
    console.log('=== Importing Board Members ===');
    console.log(`Total board members: ${focalboardBoardMembers.length}`);

    const stats = {
      created: 0,
      skipped: 0,
    };
    const skippedUsers = [];

    for (const fbMember of focalboardBoardMembers) {
      const { userId, schemeAdmin, schemeEditor, schemeViewer, schemeCommenter } = fbMember;

      const plankaUserId = userMapping[userId];

      if (!plankaUserId) {
        stats.skipped++;
        skippedUsers.push(usernameByUserId[userId] || userId);
        continue;
      }

      // Skip members with no rights in Focalboard
      const hasRights = schemeAdmin || schemeEditor || schemeViewer || schemeCommenter;
      if (!hasRights) {
        stats.skipped++;
        skippedUsers.push(usernameByUserId[userId] || userId);
        continue;
      }

      try {
        await BoardMembership.create({
          boardId,
          projectId,
          userId: plankaUserId,
          role: 'editor',
          canComment: null,
        }).fetch();

        stats.created++;
      } catch (error) {
        stats.skipped++;
        skippedUsers.push(usernameByUserId[userId] || userId);
      }
    }

    console.log('');
    console.log('--- Board Members Summary ---');
    console.log(`Created: ${stats.created}`);
    console.log(`Skipped: ${stats.skipped}`);
    if (skippedUsers.length > 0) {
      console.log(`Skipped users: ${skippedUsers.join(', ')}`);
    }
    console.log('');

    return stats;
  },
};
