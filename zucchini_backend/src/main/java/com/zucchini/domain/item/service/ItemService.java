package com.zucchini.domain.item.service;

import com.zucchini.domain.item.dto.request.ItemRequest;
import com.zucchini.domain.item.dto.response.FindItemListResponse;
import com.zucchini.domain.item.dto.response.FindItemResponse;

import java.util.Date;
import java.util.List;

public interface ItemService {

    /**
     * 상품 전체 조회
     * @param keyword : 검색어
     * @return List<FindItemListResponse> : 상품 전체 리스트
     */
    List<FindItemListResponse> findItemList(String keyword);

    /**
     * 상품 상세 조회
     * @param itemNo : 아이템 번호 (PK)
     * @return FindItemResponse : 상품 정보
     */
    FindItemResponse findItem(int itemNo);

    /**
     * 상품 등록
     * @param item : 입력된 상품 정보
     * @return itemNo : 생성된 상품 번호(PK)
     */
    int addItem(ItemRequest item);

    /**
     * 상품 수정
     * @param itemNo : 상품 번호 (PK)
     * @param item : 수정된 상품 정보
     */
    void modifyItem(int itemNo, ItemRequest item);

    /**
     * 상품 삭제
     * @param itemNo : 상품 번호 (PK)
     */
    void removeItem(int itemNo);

    /**
     * 예약, 상품 상태 (판매중 -> 예약중) 변경 (0 -> 1)
     * @param itemNo : 상품 번호 (PK)
     * @param buyer : 구매자 아이디
     */
    void modifyStatusDeal(int itemNo, String buyer);

    /**
     * 구매 확정, 상품 상태 (예약중 -> 판매완료) 변경 (1 -> 2)
     * @param itemNo : 상품 번호 (PK)
     */
    void modifyStatusConfirmation(int itemNo);

    /**
     * 예약 취소, 상품 상태 (예약중 -> 판매중) 변경 (1 -> 0)
     * @param itemNo : 상품 번호 (PK)
     */
    void modifyStatusCancel(int itemNo);

    /**
     * 상품의 화상 가능 날짜 상태 (가능 -> 예약) 변경 (0 -> 1)
     * @param itemNo : 상품 번호 (PK)
     * @param selectDate : 선택한 날짜
     */
    void modifyDateReservation(int itemNo, Date selectDate);

    /**
     * 구매자/판매자의 다른 판매 중인 상품 중 중복날짜 상태 (가능 -> 불가능) 변경 (0 -> 2)
     * @param sellerNo : 판매자 번호 (PK)
     * @param selectDate : 선택한 날짜
     */
    void modifyDateStatus(int sellerNo, Date selectDate);

}
