/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

/**
 * @description :: Imports Focalboard comments as Planka Comment records.
 *                 Handles user attribution with fallback to "[Originally by: username]" prefix.
 */

module.exports = {
  inputs: {
    comments: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard comment blocks',
    },
    cardIdMapping: {
      type: 'ref',
      required: true,
      description: 'Map of Focalboard card ID to Planka card ID',
    },
    userMapping: {
      type: 'ref',
      required: true,
      description: 'Map of Focalboard user ID to Planka user ID',
    },
    focalboardUsers: {
      type: 'ref',
      required: true,
      description: 'Array of Focalboard user objects (for usernames)',
    },
  },

  async fn(inputs) {
    const { comments, cardIdMapping, userMapping, focalboardUsers } = inputs;

    console.log('');
    console.log('=== Importing Comments ===');

    const stats = {
      totalCommentsImported: 0,
      commentsWithUser: 0,
      commentsWithoutUser: 0,
      skippedNoCard: 0,
      skippedNoText: 0,
      cardsWithCommentsUpdated: 0,
    };

    if (comments.length === 0) {
      console.log('No comments to import');
      return stats;
    }

    // Build lookup: focalboardUserId → username
    const usernames = {};
    for (const user of focalboardUsers) {
      usernames[user.userId] = user.username || user.email || user.userId;
    }

    // Group comments by card (parentId)
    const commentsByCardId = {};
    for (const comment of comments) {
      const focalboardCardId = comment.parentId;
      if (!commentsByCardId[focalboardCardId]) {
        commentsByCardId[focalboardCardId] = [];
      }
      commentsByCardId[focalboardCardId].push(comment);
    }

    // Process comments for each card
    for (const [focalboardCardId, cardComments] of Object.entries(commentsByCardId)) {
      const plankaCardId = cardIdMapping[focalboardCardId];

      if (!plankaCardId) {
        // Card wasn't imported (might have been filtered out)
        stats.skippedNoCard += cardComments.length;
        continue;
      }

      let commentsCreatedForCard = 0;

      for (const fbComment of cardComments) {
        // Comment text is in the 'title' field
        const originalText = fbComment.title?.trim();

        if (!originalText) {
          stats.skippedNoText += 1;
          continue;
        }

        // Find Planka user
        const plankaUserId = userMapping[fbComment.createdBy];

        let commentText = originalText;

        if (!plankaUserId && fbComment.createdBy) {
          // User not found in Planka - add attribution prefix
          const username = usernames[fbComment.createdBy] || fbComment.createdBy;
          commentText = `[Originally by: ${username}]\n\n${originalText}`;
          stats.commentsWithoutUser += 1;
        } else if (plankaUserId) {
          stats.commentsWithUser += 1;
        } else {
          // No createdBy at all
          stats.commentsWithoutUser += 1;
        }

        // Create comment
        await Comment.qm.createOne({
          cardId: plankaCardId,
          userId: plankaUserId || null,
          text: commentText,
        });

        stats.totalCommentsImported += 1;
        commentsCreatedForCard += 1;
      }

      // Update card's commentsTotal counter
      if (commentsCreatedForCard > 0) {
        await Card.qm.updateOne(
          { id: plankaCardId },
          { commentsTotal: commentsCreatedForCard },
        );
        stats.cardsWithCommentsUpdated += 1;
      }
    }

    console.log('');
    console.log('--- Comments Import Summary ---');
    console.log(`Total comments imported: ${stats.totalCommentsImported}`);
    console.log(`Comments with matched user: ${stats.commentsWithUser}`);
    console.log(`Comments without matched user (attributed in text): ${stats.commentsWithoutUser}`);
    console.log(`Skipped (card not found): ${stats.skippedNoCard}`);
    console.log(`Skipped (empty text): ${stats.skippedNoText}`);
    console.log(`Cards updated with comment count: ${stats.cardsWithCommentsUpdated}`);
    console.log('');

    return stats;
  },
};
