'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import CommentSection from './CommentSection';
import AuthModal from '../ui/AuthModal';

interface PostCommentsProps {
  postId: number;
}

const PostComments = ({ postId }: PostCommentsProps) => {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <CommentSection postId={postId} onAuthClick={() => setAuthOpen(true)} />
      {typeof window !== 'undefined' &&
        createPortal(
          <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />,
          document.body
        )}
    </>
  );
};

export default PostComments;
