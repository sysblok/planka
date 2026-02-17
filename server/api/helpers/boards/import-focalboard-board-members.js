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
  },

  async fn(inputs) {
    const { boardId, projectId, focalboardBoardMembers, userMapping } = inputs;

    console.log('');
    console.log('=== Importing Board Members ===');
    console.log(`Total board members: ${focalboardBoardMembers.length}`);

    const stats = {
      created: 0,
      skipped: 0,
    };

    for (const fbMember of focalboardBoardMembers) {
      const { userId, schemeAdmin, schemeEditor, schemeViewer, schemeCommenter } = fbMember;

      const plankaUserId = userMapping[userId];

      if (!plankaUserId) {
        // console.log(`⊗ Skipping board member - user not found: ${userId}`);
        stats.skipped++;
        continue;
      }

      // Determine role based on Focalboard scheme flags
      // Priority: Admin > Editor > Viewer
      let role;
      let canComment = null;

      if (schemeAdmin || schemeEditor) {
        role = 'editor';
      } else if (schemeViewer) {
        role = 'viewer';
        canComment = schemeCommenter ? true : false;
      } else {
        // Default to editor if no clear role
        role = 'editor';
      }

      try {
        await BoardMembership.create({
          boardId,
          projectId,
          userId: plankaUserId,
          role,
          canComment,
        }).fetch();

        console.log(`✓ Added board member: ${plankaUserId} (${role})`);
        stats.created++;
      } catch (error) {
        stats.skipped++;
      }
    }

    console.log('');
    console.log('--- Board Members Summary ---');
    console.log(`Created: ${stats.created}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log('');

    return stats;
  },
};
