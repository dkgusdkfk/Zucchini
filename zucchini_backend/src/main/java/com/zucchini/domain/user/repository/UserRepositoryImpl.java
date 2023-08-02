package com.zucchini.domain.user.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import com.zucchini.domain.item.domain.QItem;
import com.zucchini.domain.user.domain.QUser;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class UserRepositoryImpl implements UserRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    /**
     * 회원이 거래한 상품 개수 조회
     * @param id : 아이디
     * @return long : 상품 개수
     */
    @Override
    public long countItemsByStatusAndUserNo(String id) {
        QUser user = QUser.user;
        QItem item = QItem.item;

        int userId = queryFactory
                .select(user.no)
                .from(user)
                .where(user.id.eq(id))
                .fetchFirst();

        return queryFactory
                .select(item.count())
                .from(item)
                .where(
                        item.status.eq(2)
                                .and(
                                        item.buyer.no.eq(userId)
                                                .or(item.seller.no.eq(userId))
                                )
                )
                .fetchOne();
    }

}
